from __future__ import annotations

import os
import re
import shlex
import threading
import time
import uuid
from datetime import datetime
from pathlib import PurePosixPath

from novita_sandbox.core import Sandbox as NovitaSandbox
from novita_sandbox.core.sandbox.commands.command_handle import PtySize

from .models import (
    SANDBOX_ROOT,
    SANDBOX_TIMEOUT_SECONDS,
    SandboxConfig,
    SandboxFileEntry,
    SandboxSessionState,
    utc_now,
)
from .provider import BaseSandboxProvider, SandboxLogger


class PersistentTerminalSession:
    def __init__(self, session_name: str, handle) -> None:
        self.session_name = session_name
        self.handle = handle
        self.pid = handle.pid
        self.created_at = utc_now()
        self.last_used_at = utc_now()
        self.closed = False
        self.reader_error: str | None = None
        self._buffer = ""
        self._condition = threading.Condition()
        self._execution_lock = threading.Lock()
        self._reader_thread = threading.Thread(target=self._pump_output, daemon=True)
        self._reader_thread.start()

    def _pump_output(self) -> None:
        try:
            for stdout, stderr, pty in self.handle:
                chunks: list[str] = []
                if stdout is not None:
                    chunks.append(stdout)
                if stderr is not None:
                    chunks.append(stderr)
                if pty is not None:
                    chunks.append(pty.decode("utf-8", "replace"))

                if chunks:
                    with self._condition:
                        self._buffer += "".join(chunks)
                        self._condition.notify_all()
        except Exception as exc:  # pragma: no cover - exercised against live SDK/session failures
            with self._condition:
                self.reader_error = str(exc)
                self._condition.notify_all()
        finally:
            with self._condition:
                self.closed = True
                self._condition.notify_all()

    def mark_used(self) -> None:
        self.last_used_at = utc_now()

    def output_length(self) -> int:
        with self._condition:
            return len(self._buffer)

    def output_since(self, start_index: int) -> str:
        with self._condition:
            return self._buffer[start_index:]

    def wait_for_marker(self, marker: str, start_index: int, timeout_seconds: float) -> str | None:
        deadline = time.monotonic() + timeout_seconds
        with self._condition:
            while True:
                segment = self._buffer[start_index:]
                if marker in segment:
                    return segment

                if self.closed and self.reader_error:
                    raise RuntimeError(self.reader_error)

                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return None

                self._condition.wait(timeout=remaining)


class NovitaSandboxProvider(BaseSandboxProvider):
    name = "novita"
    _MARKER_PREFIX = "__SHALL_TOOL_DONE__"
    _STARTED_MARKER_PREFIX = "__SHALL_TOOL_STARTED__"
    _BOOTSTRAP_MARKER_PREFIX = "__SHALL_TOOL_BOOTSTRAP__"

    def ensure_ready(
        self,
        session_id: str,
        state: SandboxSessionState,
        config: SandboxConfig,
        log: SandboxLogger | None = None,
    ) -> SandboxSessionState:
        logger = log or (lambda *_: None)

        if state.sandbox is not None:
            logger("Reusing existing sandbox session")
            try:
                state.sandbox.connect(timeout=config.timeout_seconds, api_key=config.api_key)
            except Exception:
                # If reconnect fails, fall back to a full create path.
                state.sandbox = None
                state.sandbox_id = None
                state.terminal_sessions.clear()
            else:
                state.sandbox.set_timeout(config.timeout_seconds, api_key=config.api_key)
                state.status = "ready"
                state.config = config
                state.template_id = config.template_id
                state.last_error = None
                state.touch()
                return state

        if state.sandbox_id:
            logger(f"Connecting to paused/existing sandbox {state.sandbox_id}")
            try:
                sandbox = NovitaSandbox.connect(
                    state.sandbox_id,
                    timeout=config.timeout_seconds,
                    api_key=config.api_key,
                )
                sandbox.set_timeout(config.timeout_seconds, api_key=config.api_key)
                state.sandbox = sandbox
                state.terminal_sessions.clear()
                state.status = "ready"
                state.config = config
                state.template_id = config.template_id
                state.last_error = None
                state.touch()
                return state
            except Exception as exc:
                logger(f"Reconnect failed, creating a new sandbox: {exc}")
                state.last_error = str(exc)
                state.sandbox = None
                state.sandbox_id = None
                state.terminal_sessions.clear()

        logger("Creating Novita sandbox")
        create_kwargs = {
            "timeout": config.timeout_seconds,
            "api_key": config.api_key,
            "metadata": {"idle_timeout": str(max(60, min(config.timeout_seconds, SANDBOX_TIMEOUT_SECONDS)))},
        }
        if config.template_id:
            create_kwargs["template"] = config.template_id
            logger(f"Using template {config.template_id}")
        else:
            logger("Using Novita default template")

        sandbox = NovitaSandbox.create(**create_kwargs)
        sandbox.set_timeout(config.timeout_seconds, api_key=config.api_key)
        sandbox.commands.run(f"mkdir -p {SANDBOX_ROOT}", cwd=SANDBOX_ROOT)

        state.sandbox = sandbox
        state.sandbox_id = sandbox.sandbox_id
        state.provider = self.name
        state.status = "ready"
        state.template_id = config.template_id
        state.config = config
        state.created_at = state.created_at or utc_now()
        state.last_error = None
        state.terminal_sessions.clear()
        state.touch()
        logger(f"Sandbox ready: {state.sandbox_id}")
        return state

    def list_files(self, state: SandboxSessionState, path: str, depth: int = 25) -> list[SandboxFileEntry]:
        sandbox = self._require_sandbox(state)
        target = self._normalize_path(path)
        entries = sandbox.files.list(target, depth=depth)
        results: list[SandboxFileEntry] = []
        for entry in entries:
            entry_type = self._normalize_entry_type(getattr(entry, "type", "file"))
            modified_time = getattr(entry, "modified_time", None)
            if modified_time and isinstance(modified_time, datetime):
                modified = modified_time.isoformat()
            else:
                modified = None
            results.append(
                SandboxFileEntry(
                    path=getattr(entry, "path", ""),
                    name=getattr(entry, "name", os.path.basename(getattr(entry, "path", ""))),
                    type=entry_type,
                    size=int(getattr(entry, "size", 0) or 0),
                    modified_time=modified,
                )
            )
        return results

    def read_file(self, state: SandboxSessionState, file_path: str) -> str:
        sandbox = self._require_sandbox(state)
        return sandbox.files.read(self._normalize_path(file_path))

    def write_file(self, state: SandboxSessionState, file_path: str, content: str) -> None:
        sandbox = self._require_sandbox(state)
        sandbox.files.write(self._normalize_path(file_path), content)

    def replace_in_file(self, state: SandboxSessionState, file_path: str, old_string: str, new_string: str) -> tuple[str, int]:
        sandbox = self._require_sandbox(state)
        normalized_path = self._normalize_path(file_path)
        current = sandbox.files.read(normalized_path)
        occurrences = current.count(old_string)
        if occurrences == 0:
            return current, 0
        updated = current.replace(old_string, new_string)
        sandbox.files.write(normalized_path, updated)
        return updated, occurrences

    def run_command(self, state: SandboxSessionState, cmd: str, cwd: str | None = None) -> dict:
        sandbox = self._require_sandbox(state)
        result = sandbox.commands.run(
            cmd,
            cwd=self._normalize_path(cwd or SANDBOX_ROOT),
        )
        return {
            "stdout": getattr(result, "stdout", ""),
            "stderr": getattr(result, "stderr", ""),
            "exit_code": getattr(result, "exit_code", 0),
        }

    def run_terminal_command(
        self,
        state: SandboxSessionState,
        session_name: str,
        command: str,
        wait_for_output: bool = True,
        timeout_seconds: int = 180,
    ) -> dict:
        sandbox = self._require_sandbox(state)
        terminal_session = self._get_or_create_terminal_session(state, session_name)
        terminal_session.mark_used()

        with terminal_session._execution_lock:
            if wait_for_output:
                return self._run_terminal_command_and_wait(
                    sandbox=sandbox,
                    state=state,
                    terminal_session=terminal_session,
                    command=command,
                    timeout_seconds=timeout_seconds,
                )

            return self._start_terminal_command_in_background(
                sandbox=sandbox,
                state=state,
                terminal_session=terminal_session,
                command=command,
            )

    def kill(self, state: SandboxSessionState) -> None:
        if state.sandbox is None and not state.sandbox_id:
            return
        sandbox = state.sandbox
        api_key = self._api_key(state)
        try:
            if sandbox is not None:
                sandbox.kill(api_key=api_key)
            elif state.sandbox_id:
                NovitaSandbox.kill(state.sandbox_id, api_key=api_key)
        finally:
            state.sandbox = None
            state.sandbox_id = None
            state.status = "idle"
            state.last_error = None
            state.terminal_sessions.clear()
            state.touch()

    def _run_terminal_command_and_wait(
        self,
        sandbox,
        state: SandboxSessionState,
        terminal_session: PersistentTerminalSession,
        command: str,
        timeout_seconds: int,
    ) -> dict:
        marker = f"{self._MARKER_PREFIX}_{uuid.uuid4().hex}"
        start_index = terminal_session.output_length()

        sandbox.pty.send_stdin(terminal_session.pid, f"{command}\n".encode("utf-8"))
        sandbox.pty.send_stdin(
            terminal_session.pid,
            f"printf '\\n{marker}:%s\\n' \"$?\"\n".encode("utf-8"),
        )

        segment = terminal_session.wait_for_marker(marker, start_index, timeout_seconds)
        if segment is None:
            sandbox.pty.send_stdin(terminal_session.pid, b"\x03")
            time.sleep(0.25)
            output = terminal_session.output_since(start_index).rstrip("\r\n")
            return {
                "success": False,
                "session_name": terminal_session.session_name,
                "command": command,
                "wait_for_output": True,
                "output": output,
                "exit_code": None,
                "timed_out": True,
                "started": False,
                "sandbox_id": state.sandbox_id,
                "pid": terminal_session.pid,
            }

        output, exit_code = self._extract_output_and_exit_code(segment, marker)
        return {
            "success": True,
            "session_name": terminal_session.session_name,
            "command": command,
            "wait_for_output": True,
            "output": output,
            "exit_code": exit_code,
            "timed_out": False,
            "started": False,
            "sandbox_id": state.sandbox_id,
            "pid": terminal_session.pid,
        }

    def _start_terminal_command_in_background(
        self,
        sandbox,
        state: SandboxSessionState,
        terminal_session: PersistentTerminalSession,
        command: str,
    ) -> dict:
        marker = f"{self._STARTED_MARKER_PREFIX}_{uuid.uuid4().hex}"
        log_path = f"/tmp/shall-tool-{uuid.uuid4().hex}.log"
        start_index = terminal_session.output_length()

        sandbox.pty.send_stdin(
            terminal_session.pid,
            (
                f"({command}) >{shlex.quote(log_path)} 2>&1 &\n"
                f"printf '{marker}:%s\\n' \"$!\"\n"
            ).encode("utf-8"),
        )

        segment = terminal_session.wait_for_marker(marker, start_index, 10)
        started_pid = None
        output = "Command started"
        if segment is not None:
            after_marker = segment.split(marker, 1)[1]
            pid_match = re.search(r":(\d+)", after_marker)
            if pid_match:
                started_pid = int(pid_match.group(1))
                output = f"Command started (pid {started_pid})"

        return {
            "success": True,
            "session_name": terminal_session.session_name,
            "command": command,
            "wait_for_output": False,
            "output": output,
            "exit_code": None,
            "timed_out": False,
            "started": True,
            "sandbox_id": state.sandbox_id,
            "pid": terminal_session.pid,
            "background_pid": started_pid,
            "background_log_path": log_path,
        }

    def _get_or_create_terminal_session(
        self,
        state: SandboxSessionState,
        session_name: str,
    ) -> PersistentTerminalSession:
        existing = state.terminal_sessions.get(session_name)
        if isinstance(existing, PersistentTerminalSession) and not existing.closed:
            return existing

        sandbox = self._require_sandbox(state)
        handle = sandbox.pty.create(
            PtySize(cols=120, rows=40),
            cwd=SANDBOX_ROOT,
            envs={
                "TERM": "xterm-256color",
                "LANG": "C.UTF-8",
                "LC_ALL": "C.UTF-8",
                "PS1": "",
            },
            timeout=0,
        )
        terminal_session = PersistentTerminalSession(session_name=session_name, handle=handle)
        state.terminal_sessions[session_name] = terminal_session
        self._bootstrap_terminal_session(sandbox, terminal_session)
        return terminal_session

    def _bootstrap_terminal_session(self, sandbox, terminal_session: PersistentTerminalSession) -> None:
        marker = f"{self._BOOTSTRAP_MARKER_PREFIX}_{uuid.uuid4().hex}"
        start_index = terminal_session.output_length()
        sandbox.pty.send_stdin(
            terminal_session.pid,
            (
                "export PS1='' PROMPT_COMMAND=\n"
                "stty -echo\n"
                f"printf '{marker}\\n'\n"
            ).encode("utf-8"),
        )
        terminal_session.wait_for_marker(marker, start_index, 10)

    def _extract_output_and_exit_code(self, segment: str, marker: str) -> tuple[str, int | None]:
        before_marker, after_marker = segment.split(marker, 1)
        exit_match = re.search(r":(-?\d+)", after_marker)
        exit_code = int(exit_match.group(1)) if exit_match else None
        return before_marker.rstrip("\r\n"), exit_code

    def _require_sandbox(self, state: SandboxSessionState):
        if state.sandbox is None:
            raise RuntimeError("Sandbox is not ready")
        return state.sandbox

    def _api_key(self, state: SandboxSessionState) -> str:
        if state.config is None or not state.config.api_key:
            raise RuntimeError("Missing Novita sandbox API key")
        return state.config.api_key

    def _normalize_path(self, file_path: str | None) -> str:
        if not file_path:
            return SANDBOX_ROOT

        raw = PurePosixPath(file_path)
        if str(raw).startswith(SANDBOX_ROOT):
            path = raw
        elif raw.is_absolute():
            stripped = [part for part in raw.parts if part not in {"/", "home", "user"}]
            path = PurePosixPath(SANDBOX_ROOT, *stripped)
        else:
            path = PurePosixPath(SANDBOX_ROOT, *raw.parts)

        normalized_parts: list[str] = []
        for part in path.parts:
            if part in {"/", ""}:
                continue
            if part == ".":
                continue
            if part == "..":
                if normalized_parts and normalized_parts[-1] != "user":
                    normalized_parts.pop()
                continue
            normalized_parts.append(part)

        normalized = PurePosixPath("/", *normalized_parts)
        normalized_str = str(normalized)
        if not normalized_str.startswith(SANDBOX_ROOT):
            normalized_str = SANDBOX_ROOT
        return normalized_str

    def _normalize_entry_type(self, entry_type: object) -> str:
        raw = getattr(entry_type, "value", entry_type)
        value = str(raw).lower()
        if "dir" in value or "folder" in value:
            return "folder"
        return "file"