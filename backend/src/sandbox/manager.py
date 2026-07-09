from __future__ import annotations

import asyncio
from collections import defaultdict
from pathlib import PurePosixPath
from typing import Callable

from .models import SANDBOX_ROOT, SandboxConfig, SandboxFileEntry, SandboxSessionState
from .novita_provider import NovitaSandboxProvider
from .provider import BaseSandboxProvider


class SandboxManager:
    def __init__(self) -> None:
        self._sessions: dict[str, SandboxSessionState] = {}
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._providers: dict[str, BaseSandboxProvider] = {
            "novita": NovitaSandboxProvider(),
        }

    def _provider(self, name: str) -> BaseSandboxProvider:
        if name not in self._providers:
            raise ValueError(f"Unsupported sandbox provider: {name}")
        return self._providers[name]

    def get_state(self, session_id: str) -> SandboxSessionState:
        if session_id not in self._sessions:
            self._sessions[session_id] = SandboxSessionState(session_id=session_id)
        return self._sessions[session_id]

    async def ensure_ready(
        self,
        session_id: str,
        config: SandboxConfig,
        log: Callable[[str], None] | None = None,
    ) -> SandboxSessionState:
        lock = self._locks[session_id]
        async with lock:
            state = self.get_state(session_id)
            state.status = "creating"
            state.config = config
            state.provider = config.provider
            state.template_id = config.template_id
            state.touch()
            try:
                provider = self._provider(config.provider)
                state = await asyncio.to_thread(provider.ensure_ready, session_id, state, config, log)
                return state
            except Exception as exc:
                state.status = "error"
                state.last_error = str(exc)
                state.touch()
                raise

    async def list_files(self, session_id: str, path: str = SANDBOX_ROOT, depth: int = 25) -> list[SandboxFileEntry]:
        state = self.get_state(session_id)
        provider = self._provider(state.provider)
        return await asyncio.to_thread(provider.list_files, state, path, depth)

    async def read_file(self, session_id: str, file_path: str) -> str:
        state = self.get_state(session_id)
        provider = self._provider(state.provider)
        return await asyncio.to_thread(provider.read_file, state, file_path)

    async def write_file(self, session_id: str, file_path: str, content: str) -> None:
        state = self.get_state(session_id)
        provider = self._provider(state.provider)
        await asyncio.to_thread(provider.write_file, state, file_path, content)

    async def replace_in_file(self, session_id: str, file_path: str, old_string: str, new_string: str) -> tuple[str, int]:
        state = self.get_state(session_id)
        provider = self._provider(state.provider)
        return await asyncio.to_thread(provider.replace_in_file, state, file_path, old_string, new_string)

    async def run_command(self, session_id: str, cmd: str, cwd: str | None = None) -> dict:
        state = self.get_state(session_id)
        provider = self._provider(state.provider)
        return await asyncio.to_thread(provider.run_command, state, cmd, cwd)

    async def reset_session(self, session_id: str) -> None:
        state = self.get_state(session_id)
        provider = self._provider(state.provider)
        await asyncio.to_thread(provider.kill, state)
        self._sessions[session_id] = SandboxSessionState(session_id=session_id)

    def get_status(self, session_id: str) -> dict:
        return self.get_state(session_id).as_dict()

    async def get_file_tree(self, session_id: str, root_path: str = SANDBOX_ROOT, depth: int = 25) -> dict:
        entries = await self.list_files(session_id, root_path, depth=depth)
        return self._build_file_tree(root_path, entries)

    def _build_file_tree(self, root_path: str, entries: list[SandboxFileEntry]) -> dict:
        root_name = PurePosixPath(root_path).name or root_path
        root = {
            "name": root_name,
            "type": "folder",
            "path": root_path,
            "children": [],
        }
        path_map: dict[str, dict] = {root_path: root}

        def ensure_folder(path: str) -> dict:
            if path in path_map:
                return path_map[path]
            folder_path = PurePosixPath(path)
            parent_path = str(folder_path.parent)
            if parent_path == ".":
                parent_path = root_path
            parent = ensure_folder(parent_path)
            node = {
                "name": folder_path.name,
                "type": "folder",
                "path": str(folder_path),
                "children": [],
            }
            parent["children"].append(node)
            path_map[str(folder_path)] = node
            return node

        sorted_entries = sorted(entries, key=lambda entry: (entry.type != "folder", entry.path))
        for entry in sorted_entries:
            if entry.path == root_path:
                continue
            parent_path = str(PurePosixPath(entry.path).parent)
            if parent_path == ".":
                parent_path = root_path
            parent = ensure_folder(parent_path)
            node = {
                "name": entry.name,
                "type": entry.type,
                "path": entry.path,
            }
            if entry.type == "folder":
                node["children"] = []
                path_map[entry.path] = node
            if not any(child["path"] == entry.path for child in parent["children"]):
                parent["children"].append(node)

        def sort_children(node: dict) -> None:
            children = node.get("children")
            if not children:
                return
            children.sort(key=lambda child: (child["type"] != "folder", child["name"].lower()))
            for child in children:
                sort_children(child)

        sort_children(root)
        return root