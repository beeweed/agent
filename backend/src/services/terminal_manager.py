"""
Terminal Manager Service

Manages PTY terminal sessions over WebSocket using E2B sandbox PTY API.
Provides a real interactive shell experience - full bash with job control,
signal handling, colors, cursor movement, and all PTY features.
"""

import asyncio
import base64
import json
import logging
from typing import Dict, Optional

from fastapi import WebSocket

from e2b.sandbox.commands.command_handle import PtySize

logger = logging.getLogger(__name__)


class TerminalSession:
    """Represents a single PTY terminal session tied to an E2B sandbox."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.pid: Optional[int] = None
        self.handle = None
        self.websocket: Optional[WebSocket] = None
        self._active = False

    @property
    def is_active(self) -> bool:
        return self._active and self.pid is not None


class TerminalManager:
    """
    Manages multiple PTY terminal sessions.
    
    Each sandbox session can have one active PTY terminal.
    The terminal is a real bash shell running inside the E2B sandbox,
    with full PTY support (colors, cursor, signals, job control).
    """

    def __init__(self):
        self.sessions: Dict[str, TerminalSession] = {}

    async def handle_websocket(
        self,
        websocket: WebSocket,
        session_id: str,
        sandbox_manager,
    ):
        """
        Main WebSocket handler for terminal connections.
        
        Creates a PTY in the E2B sandbox and bridges I/O between
        the WebSocket client and the sandbox PTY.
        """
        sandbox = await sandbox_manager.get_sandbox(session_id)
        if not sandbox:
            await websocket.send_json({
                "type": "error",
                "message": "No sandbox found. Please create a sandbox first."
            })
            await websocket.close()
            return

        session = TerminalSession(session_id)
        session.websocket = websocket
        self.sessions[session_id] = session

        send_lock = asyncio.Lock()

        async def on_pty_data(data: bytes):
            """Callback when PTY produces output - forward to WebSocket."""
            if session.websocket and session._active:
                try:
                    encoded = base64.b64encode(data).decode("ascii")
                    async with send_lock:
                        await session.websocket.send_json({
                            "type": "output",
                            "data": encoded,
                        })
                except Exception as e:
                    logger.debug(f"Failed to send PTY output: {e}")

        try:
            pty_handle = await sandbox.pty.create(
                size=PtySize(rows=24, cols=80),
                on_data=on_pty_data,
                cwd="/home/user",
                envs={
                    "TERM": "xterm-256color",
                    "COLORTERM": "truecolor",
                    "LANG": "en_US.UTF-8",
                    "LC_ALL": "en_US.UTF-8",
                },
                timeout=0,
            )

            session.handle = pty_handle
            session.pid = pty_handle.pid
            session._active = True

            await websocket.send_json({
                "type": "connected",
                "pid": pty_handle.pid,
            })

            while True:
                raw = await websocket.receive_text()
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                msg_type = msg.get("type")

                if msg_type == "input":
                    data_b64 = msg.get("data", "")
                    try:
                        raw_bytes = base64.b64decode(data_b64)
                        await sandbox.pty.send_stdin(session.pid, raw_bytes)
                    except Exception as e:
                        logger.debug(f"Failed to send stdin: {e}")

                elif msg_type == "resize":
                    cols = msg.get("cols", 80)
                    rows = msg.get("rows", 24)
                    try:
                        await sandbox.pty.resize(
                            session.pid,
                            PtySize(rows=rows, cols=cols),
                        )
                    except Exception as e:
                        logger.debug(f"Failed to resize PTY: {e}")

                elif msg_type == "ping":
                    async with send_lock:
                        await websocket.send_json({"type": "pong"})

        except Exception as e:
            if "disconnect" not in str(e).lower() and "1000" not in str(e):
                logger.error(f"Terminal session error: {e}")
                try:
                    async with send_lock:
                        await websocket.send_json({
                            "type": "error",
                            "message": str(e),
                        })
                except Exception:
                    pass
        finally:
            session._active = False

    async def cleanup_session(self, session_id: str):
        """Clean up terminal session resources."""
        session = self.sessions.pop(session_id, None)
        if session:
            session._active = False
            if session.handle:
                try:
                    await session.handle.kill()
                except Exception:
                    pass


terminal_manager = TerminalManager()