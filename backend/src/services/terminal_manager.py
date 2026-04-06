"""
Terminal Manager Service

Manages PTY terminal sessions over WebSocket using E2B sandbox PTY API.
Provides a real interactive shell experience — full bash with job control,
signal handling, colors, cursor movement, TUI apps (vim, htop, nano),
and all PTY features a real VS Code terminal would support.

Shell tool commands are executed exclusively through the PTY terminal.
Output is captured by monitoring PTY data until the shell prompt appears.

Session-name-aware: the LLM provides a session_name with each shell call.
The manager maps that to a frontend terminal tab and waits for the tab's
WebSocket PTY to be fully initialized before running the command.
"""

import asyncio
import base64
import json
import logging
import re
from typing import Dict, Optional

from fastapi import WebSocket

from e2b.sandbox.commands.command_handle import PtySize

logger = logging.getLogger(__name__)

PING_INTERVAL_SEC = 15
COMMAND_TIMEOUT_SEC = 180  # 3 minutes
SHELL_COMMAND_TIMEOUT_SEC = 120  # 2 minutes max for a single command
TERMINAL_READY_TIMEOUT_SEC = 30  # max wait for frontend terminal to connect

ANSI_ESCAPE_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\[.*?[@-~]|\r')


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE_RE.sub('', text)


class TerminalSession:
    """Represents a single PTY terminal session tied to an E2B sandbox."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.pid: Optional[int] = None
        self.handle = None
        self.websocket: Optional[WebSocket] = None
        self._active = False
        self._send_lock = asyncio.Lock()
        self._last_activity = asyncio.get_event_loop().time()
        self._capture_buffer: list[bytes] = []
        self._capturing = False
        self._capture_event: Optional[asyncio.Event] = None

    @property
    def is_active(self) -> bool:
        return self._active and self.pid is not None

    def touch(self):
        try:
            self._last_activity = asyncio.get_event_loop().time()
        except RuntimeError:
            pass

    def start_capture(self):
        self._capture_buffer = []
        self._capture_event = asyncio.Event()
        self._capturing = True

    def stop_capture(self) -> str:
        self._capturing = False
        raw = b"".join(self._capture_buffer)
        self._capture_buffer = []
        self._capture_event = None
        return raw.decode("utf-8", errors="replace")

    def append_capture(self, data: bytes):
        if self._capturing:
            self._capture_buffer.append(data)
            raw_so_far = b"".join(self._capture_buffer).decode("utf-8", errors="replace")
            cleaned = strip_ansi(raw_so_far)
            lines = cleaned.split("\n")
            for line in lines[-3:]:
                stripped = line.strip()
                if stripped.endswith("$") or stripped.endswith("$ ") or stripped.endswith("#") or stripped.endswith("# "):
                    if self._capture_event:
                        self._capture_event.set()
                    return

    async def safe_send(self, data: dict) -> bool:
        if not self.websocket or not self._active:
            return False
        try:
            async with self._send_lock:
                await self.websocket.send_json(data)
            return True
        except Exception:
            return False


class TerminalManager:
    """
    Manages multiple PTY terminal sessions.

    Each sandbox session can have multiple PTY terminals, each identified
    by the LLM's session_name. The manager keeps a mapping from
    session_name → terminal tab id and uses asyncio.Event objects to
    coordinate between the agent (which needs to run a command) and
    the frontend (which connects the WebSocket PTY).
    """

    def __init__(self):
        self.sessions: Dict[str, TerminalSession] = {}
        self._ready_events: Dict[str, asyncio.Event] = {}
        self._session_name_to_tab: Dict[str, str] = {}

    def get_terminal_key_for_session_name(self, sandbox_session_id: str, session_name: str) -> Optional[str]:
        """Return the composite terminal key if session_name is already mapped."""
        tab_id = self._session_name_to_tab.get(session_name)
        if tab_id is None:
            return None
        return f"{sandbox_session_id}__term__{tab_id}"

    def register_session_name(self, session_name: str, tab_id: str):
        """Map a session_name to a terminal tab id."""
        self._session_name_to_tab[session_name] = tab_id
        logger.info(f"Registered session_name '{session_name}' → tab '{tab_id}'")

    def is_session_name_known(self, session_name: str) -> bool:
        """Check if a session_name is already mapped to a terminal tab."""
        return session_name in self._session_name_to_tab

    def get_tab_id_for_session_name(self, session_name: str) -> Optional[str]:
        """Return the tab id for a session_name, or None."""
        return self._session_name_to_tab.get(session_name)

    def create_ready_event(self, terminal_key: str) -> asyncio.Event:
        """Create (or reset) a readiness event for a terminal key."""
        event = asyncio.Event()
        self._ready_events[terminal_key] = event
        logger.info(f"Created ready event for terminal key '{terminal_key}'")
        return event

    def signal_ready(self, terminal_key: str):
        """Signal that a terminal session is fully initialized and ready."""
        event = self._ready_events.get(terminal_key)
        if event:
            event.set()
            logger.info(f"Terminal ready signal set for '{terminal_key}'")

    async def wait_for_ready(self, terminal_key: str, timeout: int = TERMINAL_READY_TIMEOUT_SEC) -> bool:
        """Wait until the terminal session is ready (PTY connected)."""
        event = self._ready_events.get(terminal_key)
        if event is None:
            event = self.create_ready_event(terminal_key)

        session = self.sessions.get(terminal_key)
        if session and session.is_active:
            return True

        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.warning(f"Timed out waiting for terminal '{terminal_key}' to be ready")
            return False

    async def handle_websocket(
        self,
        websocket: WebSocket,
        session_id: str,
        sandbox_manager,
        sandbox_session_id: str = None,
    ):
        """
        Main WebSocket handler for terminal connections.

        Creates a PTY in the E2B sandbox and bridges I/O between
        the WebSocket client and the sandbox PTY.

        Args:
            websocket: The WebSocket connection
            session_id: Unique key for this terminal session (may include terminal index)
            sandbox_manager: Reference to the sandbox manager
            sandbox_session_id: The sandbox session to look up (defaults to session_id
                               for backward compatibility). For multi-terminal, this is
                               the base session_id while session_id is the composite key.
        """
        lookup_id = sandbox_session_id or session_id
        sandbox = await sandbox_manager.get_sandbox(lookup_id)
        if not sandbox:
            await websocket.send_json({
                "type": "error",
                "message": "No sandbox found. Please create a sandbox first."
            })
            await websocket.close()
            return

        # Clean up any previous session for this ID
        await self.cleanup_session(session_id)

        session = TerminalSession(session_id)
        session.websocket = websocket
        self.sessions[session_id] = session

        async def on_pty_data(data: bytes):
            """Callback when PTY produces output — forward to WebSocket and capture buffer."""
            if not session._active:
                return
            session.touch()
            session.append_capture(data)
            try:
                encoded = base64.b64encode(data).decode("ascii")
                await session.safe_send({"type": "output", "data": encoded})
            except Exception as e:
                logger.debug(f"Failed to send PTY output: {e}")

        try:
            # Create the PTY with env vars that enable full TUI/color support
            pty_handle = await sandbox.pty.create(
                size=PtySize(rows=24, cols=80),
                on_data=on_pty_data,
                cwd="/home/user",
                envs={
                    "TERM": "xterm-256color",
                    "COLORTERM": "truecolor",
                    "LANG": "en_US.UTF-8",
                    "LC_ALL": "en_US.UTF-8",
                    "EDITOR": "vim",
                    "VISUAL": "vim",
                },
                timeout=0,  # unlimited — we manage lifecycle ourselves
            )

            session.handle = pty_handle
            session.pid = pty_handle.pid
            session._active = True
            session.touch()

            await session.safe_send({
                "type": "connected",
                "pid": pty_handle.pid,
            })

            self.signal_ready(session_id)

            # Start the ping/keepalive task
            ping_task = asyncio.create_task(
                self._ping_loop(session)
            )

            try:
                while session._active:
                    try:
                        raw = await asyncio.wait_for(
                            websocket.receive_text(),
                            timeout=COMMAND_TIMEOUT_SEC,
                        )
                    except asyncio.TimeoutError:
                        # 3 minute idle timeout — send a notice but keep alive
                        await session.safe_send({
                            "type": "output",
                            "data": base64.b64encode(
                                b"\r\n\x1b[33m[Terminal idle for 3 minutes]\x1b[0m\r\n"
                            ).decode("ascii"),
                        })
                        session.touch()
                        continue

                    session.touch()

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
                            # If stdin fails, the PTY may have died — try to notify
                            await session.safe_send({
                                "type": "error",
                                "message": f"PTY stdin error: {e}",
                            })

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
                        await session.safe_send({"type": "pong"})

            finally:
                ping_task.cancel()
                try:
                    await ping_task
                except (asyncio.CancelledError, Exception):
                    pass

        except Exception as e:
            err_str = str(e).lower()
            if "disconnect" not in err_str and "1000" not in err_str and "1001" not in err_str:
                logger.error(f"Terminal session error: {e}")
                await session.safe_send({
                    "type": "error",
                    "message": str(e),
                })
        finally:
            session._active = False

    async def _ping_loop(self, session: TerminalSession):
        """Send periodic pings to keep the WebSocket alive."""
        try:
            while session._active:
                await asyncio.sleep(PING_INTERVAL_SEC)
                if not session._active:
                    break
                ok = await session.safe_send({"type": "ping"})
                if not ok:
                    logger.debug(f"Ping failed for session {session.session_id}, marking inactive")
                    session._active = False
                    break
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    async def execute_in_terminal(
        self,
        session_id: str,
        command: str,
        sandbox_manager,
        timeout: int = SHELL_COMMAND_TIMEOUT_SEC,
        wait_for_output: bool = True,
    ) -> dict:
        """
        Execute a command in the PTY terminal and capture its output.

        The command is typed into the real terminal visible to the user.
        Output is captured by buffering PTY data until the shell prompt
        (ending with '$' or '#') re-appears, indicating the command finished.

        If the terminal session is not yet ready (e.g. frontend is still
        connecting the WebSocket), this method waits for the ready event
        before proceeding — no time-based delays.

        Args:
            session_id: Terminal session key (composite key)
            command: The shell command to execute
            sandbox_manager: Reference to sandbox manager for PTY access
            timeout: Max seconds to wait for the command to finish
            wait_for_output: If False, fire-and-forget (don't wait for prompt)

        Returns:
            Dict with success, output, and optional exit_code
        """
        session = self.sessions.get(session_id)
        if not session or not session.is_active or not session.pid:
            logger.info(f"Terminal '{session_id}' not active yet, waiting for ready signal...")
            ready = await self.wait_for_ready(session_id)
            if not ready:
                logger.warning(f"Terminal '{session_id}' never became ready")
                return {
                    "success": False,
                    "output": "Terminal session timed out waiting to initialize.",
                    "error": "Terminal not ready",
                }
            session = self.sessions.get(session_id)
            if not session or not session.is_active or not session.pid:
                logger.warning(f"Terminal '{session_id}' still not active after ready signal")
                return {
                    "success": False,
                    "output": "No active terminal session after initialization.",
                    "error": "No active terminal session",
                }

        sandbox_base = session_id.split("__term__")[0] if "__term__" in session_id else session_id
        try:
            sandbox = await sandbox_manager.get_sandbox(sandbox_base)
            if not sandbox:
                logger.warning(f"No sandbox found for {sandbox_base}")
                return {
                    "success": False,
                    "output": "No sandbox found for session.",
                    "error": "No sandbox found",
                }

            if not wait_for_output:
                command_bytes = (command + "\n").encode("utf-8")
                await sandbox.pty.send_stdin(session.pid, command_bytes)
                return {
                    "success": True,
                    "output": "Command started in background (no output captured).",
                }

            session.start_capture()

            command_bytes = (command + "\n").encode("utf-8")
            await sandbox.pty.send_stdin(session.pid, command_bytes)

            try:
                await asyncio.wait_for(
                    session._capture_event.wait(),
                    timeout=timeout,
                )
            except asyncio.TimeoutError:
                raw_output = session.stop_capture()
                cleaned = strip_ansi(raw_output)
                lines = cleaned.strip().split("\n")
                if lines and lines[0].strip() == command.strip():
                    lines = lines[1:]
                output = "\n".join(lines).strip()
                if not output:
                    output = "(command timed out with no output)"
                return {
                    "success": True,
                    "output": output,
                    "timed_out": True,
                }

            await asyncio.sleep(0.1)

            raw_output = session.stop_capture()
            cleaned = strip_ansi(raw_output)

            lines = cleaned.strip().split("\n")
            if lines and lines[0].strip() == command.strip():
                lines = lines[1:]
            if lines:
                last = lines[-1].strip()
                if last.endswith("$") or last.endswith("#") or last.endswith("$ ") or last.endswith("# "):
                    lines = lines[:-1]

            output = "\n".join(lines).strip()
            if not output:
                output = "Command executed successfully (no output)."

            return {
                "success": True,
                "output": output,
            }

        except Exception as e:
            logger.error(f"Failed to execute command in terminal: {e}")
            if session._capturing:
                session.stop_capture()
            return {
                "success": False,
                "output": str(e),
                "error": str(e),
            }

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
            session.websocket = None
            session.handle = None


terminal_manager = TerminalManager()