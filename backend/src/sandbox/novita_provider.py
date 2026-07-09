from __future__ import annotations

import os
from datetime import datetime
from pathlib import PurePosixPath
from typing import Iterable

from novita_sandbox.core import Sandbox as NovitaSandbox

from .models import SANDBOX_ROOT, SANDBOX_TIMEOUT_SECONDS, SandboxConfig, SandboxFileEntry, SandboxSessionState, utc_now
from .provider import BaseSandboxProvider, SandboxLogger


class NovitaSandboxProvider(BaseSandboxProvider):
    name = "novita"

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
            state.touch()

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