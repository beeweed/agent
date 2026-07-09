from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable

from .models import SandboxConfig, SandboxFileEntry, SandboxSessionState

SandboxLogger = Callable[[str], None]


class BaseSandboxProvider(ABC):
    name: str

    @abstractmethod
    def ensure_ready(
        self,
        session_id: str,
        state: SandboxSessionState,
        config: SandboxConfig,
        log: SandboxLogger | None = None,
    ) -> SandboxSessionState:
        raise NotImplementedError

    @abstractmethod
    def list_files(self, state: SandboxSessionState, path: str, depth: int = 25) -> list[SandboxFileEntry]:
        raise NotImplementedError

    @abstractmethod
    def read_file(self, state: SandboxSessionState, file_path: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def write_file(self, state: SandboxSessionState, file_path: str, content: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def replace_in_file(self, state: SandboxSessionState, file_path: str, old_string: str, new_string: str) -> tuple[str, int]:
        raise NotImplementedError

    @abstractmethod
    def run_command(self, state: SandboxSessionState, cmd: str, cwd: str | None = None) -> dict:
        raise NotImplementedError

    @abstractmethod
    def kill(self, state: SandboxSessionState) -> None:
        raise NotImplementedError