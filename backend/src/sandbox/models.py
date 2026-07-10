from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

SANDBOX_ROOT = "/home/user"
SANDBOX_TIMEOUT_SECONDS = 3600
SHALL_TOOL_TIMEOUT_SECONDS = 180

SandboxStatus = Literal["idle", "creating", "ready", "error", "paused"]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class SandboxConfig:
    api_key: str
    template_id: str | None = None
    provider: str = "novita"
    timeout_seconds: int = SANDBOX_TIMEOUT_SECONDS


@dataclass(slots=True)
class SandboxFileEntry:
    path: str
    name: str
    type: str
    size: int = 0
    modified_time: str | None = None


@dataclass(slots=True)
class SandboxSessionState:
    session_id: str
    provider: str = "novita"
    sandbox_id: str | None = None
    status: SandboxStatus = "idle"
    template_id: str | None = None
    root_path: str = SANDBOX_ROOT
    last_error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime = field(default_factory=utc_now)
    sandbox: Any | None = None
    config: SandboxConfig | None = None
    terminal_sessions: dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        self.updated_at = utc_now()

    def as_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "provider": self.provider,
            "sandbox_id": self.sandbox_id,
            "status": self.status,
            "template_id": self.template_id,
            "root_path": self.root_path,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat(),
            "terminal_sessions": sorted(self.terminal_sessions.keys()),
        }