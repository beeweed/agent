"""
Tool Executor — executes tool calls returned by the LLM API.

Each function takes validated arguments, executes the action inside the active
sandbox for the session, and returns a structured result dict.
"""

from __future__ import annotations

from typing import Callable, Awaitable, Dict

from ..sandbox.manager import SandboxManager
from ..sandbox.models import SANDBOX_ROOT, SHALL_TOOL_TIMEOUT_SECONDS

_sandbox_manager: SandboxManager | None = None


def configure_tool_executor(manager: SandboxManager) -> None:
    global _sandbox_manager
    _sandbox_manager = manager


def _require_manager() -> SandboxManager:
    if _sandbox_manager is None:
        raise RuntimeError("Sandbox manager has not been configured")
    return _sandbox_manager


def _normalize_result_path(file_path: str) -> str:
    if not file_path:
        return SANDBOX_ROOT
    if file_path.startswith(SANDBOX_ROOT):
        return file_path
    if file_path.startswith("/"):
        return f"{SANDBOX_ROOT}{file_path}"
    return f"{SANDBOX_ROOT}/{file_path}"


async def execute_file_write(session_id: str, arguments: dict) -> dict:
    file_path = arguments.get("file_path", "")
    content = arguments.get("content", "")
    manager = _require_manager()
    await manager.write_file(session_id, file_path, content)
    resolved_path = _normalize_result_path(file_path)
    return {
        "success": True,
        "message": f"Successfully created/wrote file at {resolved_path}",
        "file_path": resolved_path,
        "content": content,
    }


async def execute_file_read(session_id: str, arguments: dict) -> dict:
    file_path = arguments.get("file_path", "")
    manager = _require_manager()
    resolved_path = _normalize_result_path(file_path)
    try:
        content = await manager.read_file(session_id, file_path)
    except Exception as exc:
        return {
            "success": False,
            "error": f"File not found: {resolved_path}. {exc}",
            "file_path": resolved_path,
        }

    lines = content.split("\n")
    formatted_lines = [f"{i + 1:6d}\t{line}" for i, line in enumerate(lines)]
    formatted_content = "\n".join(formatted_lines)
    return {
        "success": True,
        "content": formatted_content,
        "raw_content": content,
        "file_path": resolved_path,
        "file_name": resolved_path.split("/")[-1],
        "total_lines": len(lines),
        "lines_read": len(lines),
    }


async def execute_replace_in_file(session_id: str, arguments: dict) -> dict:
    file_path = arguments.get("file_path", "")
    old_string = arguments.get("old_string", "")
    new_string = arguments.get("new_string", "")
    manager = _require_manager()
    resolved_path = _normalize_result_path(file_path)

    try:
        new_content, occurrences = await manager.replace_in_file(session_id, file_path, old_string, new_string)
    except Exception as exc:
        return {
            "success": False,
            "error": f"Could not read {resolved_path}: {exc}",
            "file_path": resolved_path,
        }

    if occurrences == 0:
        return {
            "success": False,
            "error": f"old_string not found in {resolved_path}",
            "file_path": resolved_path,
        }

    return {
        "success": True,
        "message": f"Replaced {occurrences} occurrence(s) in {resolved_path}",
        "file_path": resolved_path,
        "old_string": old_string,
        "new_string": new_string,
        "occurrences": occurrences,
        "new_content": new_content,
    }


async def execute_shall_tool(session_id: str, arguments: dict) -> dict:
    manager = _require_manager()
    session_name = arguments.get("session_name", "")
    command = arguments.get("command", "")
    wait_for_output = arguments.get("wait_for_output", True)

    if not session_name:
        return {
            "success": False,
            "session_name": session_name,
            "command": command,
            "wait_for_output": wait_for_output,
            "output": "session_name is required",
            "exit_code": None,
            "timed_out": False,
            "started": False,
        }

    if not command:
        return {
            "success": False,
            "session_name": session_name,
            "command": command,
            "wait_for_output": wait_for_output,
            "output": "command is required",
            "exit_code": None,
            "timed_out": False,
            "started": False,
        }

    try:
        return await manager.run_terminal_command(
            session_id=session_id,
            session_name=session_name,
            command=command,
            wait_for_output=wait_for_output,
            timeout_seconds=SHALL_TOOL_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        return {
            "success": False,
            "session_name": session_name,
            "command": command,
            "wait_for_output": wait_for_output,
            "output": str(exc),
            "exit_code": None,
            "timed_out": False,
            "started": False,
        }


TOOL_EXECUTORS: Dict[str, Callable[..., Awaitable[dict]]] = {
    "file_write": execute_file_write,
    "file_read": execute_file_read,
    "replace_in_file": execute_replace_in_file,
    "shall_tool": execute_shall_tool,
}