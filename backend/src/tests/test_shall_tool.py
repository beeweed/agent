from __future__ import annotations

import sys
import asyncio
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from backend.src.agent.tool_executor import configure_tool_executor, execute_shall_tool
from backend.src.agent.tool_schemas import TOOL_SCHEMAS
from backend.src.sandbox.models import SHALL_TOOL_TIMEOUT_SECONDS
from backend.src.sandbox.novita_provider import NovitaSandboxProvider


class FakeSandboxManager:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def run_terminal_command(
        self,
        session_id: str,
        session_name: str,
        command: str,
        wait_for_output: bool,
        timeout_seconds: int,
    ) -> dict:
        call = {
            "session_id": session_id,
            "session_name": session_name,
            "command": command,
            "wait_for_output": wait_for_output,
            "timeout_seconds": timeout_seconds,
        }
        self.calls.append(call)
        return {
            "success": True,
            "session_name": session_name,
            "command": command,
            "wait_for_output": wait_for_output,
            "output": "hello from sandbox",
            "exit_code": 0,
            "timed_out": False,
            "started": False,
        }


def test_tool_schema_registers_shall_tool() -> None:
    shall_tool = next(
        tool for tool in TOOL_SCHEMAS if tool["function"]["name"] == "shall_tool"
    )

    assert shall_tool["function"]["description"]
    assert shall_tool["function"]["parameters"]["required"] == ["session_name", "command"]
    assert "wait_for_output" in shall_tool["function"]["parameters"]["properties"]


def test_execute_shall_tool_uses_terminal_manager() -> None:
    manager = FakeSandboxManager()
    configure_tool_executor(manager)  # type: ignore[arg-type]

    result = asyncio.run(
        execute_shall_tool(
            "chat-session",
            {
                "session_name": "terminal-a",
                "command": "pwd",
            },
        )
    )

    assert result["success"] is True
    assert manager.calls == [
        {
            "session_id": "chat-session",
            "session_name": "terminal-a",
            "command": "pwd",
            "wait_for_output": True,
            "timeout_seconds": SHALL_TOOL_TIMEOUT_SECONDS,
        }
    ]


def test_extract_output_and_exit_code_keeps_terminal_output() -> None:
    provider = NovitaSandboxProvider()
    output, exit_code = provider._extract_output_and_exit_code(
        "line 1\nline 2\n__SHALL_TOOL_DONE__token:7\n",
        "__SHALL_TOOL_DONE__token",
    )

    assert output == "line 1\nline 2"
    assert exit_code == 7