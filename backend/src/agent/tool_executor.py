"""
Tool Executor — executes tool calls returned by the LLM API.

Each function takes validated arguments and the sandbox manager,
executes the action, and returns a structured result dict.

No prompt parsing. No manual routing. Called directly from the agent loop
after the API returns a structured tool_call object.
"""

import asyncio
import uuid
from typing import Dict, Any, Optional, Callable, Awaitable

from ..services.e2b_sandbox import sandbox_manager


# ---------------------------------------------------------------------------
# Shell output coordination (frontend executes, posts result back)
# ---------------------------------------------------------------------------

_pending_shell_outputs: Dict[str, Dict[str, Any]] = {}
_shell_output_events: Dict[str, asyncio.Event] = {}


def register_shell_command(command_id: str) -> asyncio.Event:
    _pending_shell_outputs[command_id] = {
        "output": "",
        "completed": False,
        "error": None,
        "success": None,
    }
    _shell_output_events[command_id] = asyncio.Event()
    return _shell_output_events[command_id]


def submit_shell_output(
    command_id: str,
    output: str,
    success: bool = True,
    error: Optional[str] = None,
):
    if command_id in _pending_shell_outputs:
        _pending_shell_outputs[command_id] = {
            "output": output,
            "completed": True,
            "success": success,
            "error": error,
        }
        if command_id in _shell_output_events:
            _shell_output_events[command_id].set()


def get_shell_output(command_id: str) -> Dict[str, Any]:
    return _pending_shell_outputs.get(
        command_id, {"output": "", "completed": False, "error": None}
    )


def cleanup_shell_command(command_id: str):
    _pending_shell_outputs.pop(command_id, None)
    _shell_output_events.pop(command_id, None)


# ---------------------------------------------------------------------------
# Path helper
# ---------------------------------------------------------------------------

def _ensure_home_path(file_path: str) -> str:
    if not file_path.startswith("/home/user/"):
        return f"/home/user/{file_path.lstrip('/')}"
    return file_path


# ---------------------------------------------------------------------------
# Individual tool executors
# ---------------------------------------------------------------------------

async def execute_file_write(session_id: str, arguments: dict) -> dict:
    file_path = _ensure_home_path(arguments.get("file_path", ""))
    content = arguments.get("content", "")
    return await sandbox_manager.write_file(session_id, file_path, content)


async def execute_file_read(session_id: str, arguments: dict) -> dict:
    file_path = _ensure_home_path(arguments.get("file_path", ""))
    return await sandbox_manager.read_file(session_id, file_path)


async def execute_shell(
    session_id: str,
    arguments: dict,
    command_id: str,
) -> dict:
    command = arguments.get("command", "")
    session_name = arguments.get("session_name", "main")

    if not command:
        return {"success": False, "error": "No command provided", "session_name": session_name}

    sandbox = await sandbox_manager.get_sandbox(session_id)
    if not sandbox:
        return {"success": False, "error": "No sandbox found.", "session_name": session_name}

    completion_event = register_shell_command(command_id)

    try:
        await asyncio.wait_for(completion_event.wait(), timeout=300)
    except asyncio.TimeoutError:
        cleanup_shell_command(command_id)
        return {
            "success": False,
            "error": "Command timed out (300s)",
            "session_name": session_name,
            "command": command,
        }

    result = get_shell_output(command_id)
    cleanup_shell_command(command_id)

    output = result.get("output", "")
    error = result.get("error")
    success = result.get("success", True)

    if error:
        return {
            "success": False,
            "error": error,
            "output": output,
            "session_name": session_name,
            "command": command,
        }

    return {
        "success": success,
        "output": output.strip() if output else "(no output)",
        "session_name": session_name,
        "command": command,
    }


async def _read_raw_content(session_id: str, file_path: str) -> Optional[str]:
    """Read raw file content (no line numbers) for edit operations."""
    result = await sandbox_manager.read_file(session_id, file_path)
    if not result.get("success"):
        return None
    raw = result.get("raw_content", "")
    if raw:
        return raw
    content = result.get("content", "")
    if not content:
        return None
    lines = content.split("\n")
    raw_lines = []
    for line in lines:
        if "\t" in line:
            raw_lines.append(line.split("\t", 1)[1])
        else:
            raw_lines.append(line)
    return "\n".join(raw_lines)


async def execute_replace_in_file(session_id: str, arguments: dict) -> dict:
    file_path = _ensure_home_path(arguments.get("file_path", ""))
    old_string = arguments.get("old_string", "")
    new_string = arguments.get("new_string", "")

    raw = await _read_raw_content(session_id, file_path)
    if raw is None:
        return {"success": False, "error": f"Could not read {file_path}", "file_path": file_path}

    occurrences = raw.count(old_string)
    if occurrences == 0:
        return {
            "success": False,
            "error": f"old_string not found in {file_path}",
            "file_path": file_path,
        }

    new_content = raw.replace(old_string, new_string)
    write_result = await sandbox_manager.write_file(session_id, file_path, new_content)

    if not write_result.get("success"):
        return {"success": False, "error": f"Write failed: {write_result.get('error')}", "file_path": file_path}

    return {
        "success": True,
        "message": f"Replaced {occurrences} occurrence(s) in {file_path}",
        "file_path": file_path,
        "old_string": old_string,
        "new_string": new_string,
        "occurrences": occurrences,
    }


async def execute_insert_line(session_id: str, arguments: dict) -> dict:
    file_path = _ensure_home_path(arguments.get("file_path", ""))
    insert_at = arguments.get("insert_line", 0)
    new_str = arguments.get("new_str", "")

    raw = await _read_raw_content(session_id, file_path)
    if raw is None:
        return {"success": False, "error": f"Could not read {file_path}", "file_path": file_path}

    lines = raw.split("\n")
    if insert_at < 0 or insert_at > len(lines):
        return {"success": False, "error": f"Line {insert_at} out of range (0-{len(lines)})", "file_path": file_path}

    new_lines = new_str.split("\n")
    if insert_at == 0:
        new_content = new_str + "\n" + raw
    else:
        before = "\n".join(lines[:insert_at])
        after = "\n".join(lines[insert_at:])
        new_content = before + "\n" + new_str + ("\n" + after if after else "")

    write_result = await sandbox_manager.write_file(session_id, file_path, new_content)
    if not write_result.get("success"):
        return {"success": False, "error": f"Write failed: {write_result.get('error')}", "file_path": file_path}

    return {
        "success": True,
        "message": f"Inserted {len(new_lines)} line(s) after line {insert_at} in {file_path}",
        "file_path": file_path,
        "insert_line": insert_at,
        "new_str": new_str,
        "lines_inserted": len(new_lines),
    }


async def execute_delete_lines(session_id: str, arguments: dict) -> dict:
    file_path = _ensure_home_path(arguments.get("file_path", ""))
    target_line = arguments.get("target_line")

    raw = await _read_raw_content(session_id, file_path)
    if raw is None:
        return {"success": False, "error": f"Could not read {file_path}", "file_path": file_path}

    # Parse target_line into start/end
    if isinstance(target_line, int):
        start, end = target_line, target_line
    elif isinstance(target_line, str):
        target_line = target_line.strip()
        if "-" in target_line:
            parts = target_line.split("-", 1)
            try:
                start, end = int(parts[0].strip()), int(parts[1].strip())
            except ValueError:
                return {"success": False, "error": f"Invalid range: '{target_line}'", "file_path": file_path}
        else:
            try:
                start = end = int(target_line)
            except ValueError:
                return {"success": False, "error": f"Invalid target_line: '{target_line}'", "file_path": file_path}
    else:
        return {"success": False, "error": f"target_line must be int or string", "file_path": file_path}

    lines = raw.split("\n")
    total = len(lines)

    if start < 1 or end < start or start > total or end > total:
        return {"success": False, "error": f"Line range {start}-{end} out of bounds (1-{total})", "file_path": file_path}

    deleted = lines[start - 1 : end]
    remaining = lines[: start - 1] + lines[end:]
    new_content = "\n".join(remaining)

    write_result = await sandbox_manager.write_file(session_id, file_path, new_content)
    if not write_result.get("success"):
        return {"success": False, "error": f"Write failed: {write_result.get('error')}", "file_path": file_path}

    return {
        "success": True,
        "message": f"Deleted lines {start}-{end} from {file_path}",
        "file_path": file_path,
        "deleted_lines": "\n".join(deleted),
        "start_line": start,
        "end_line": end,
        "lines_deleted": end - start + 1,
    }


async def execute_delete_str(session_id: str, arguments: dict) -> dict:
    file_path = _ensure_home_path(arguments.get("file_path", ""))
    target_str = arguments.get("target_str", "")

    raw = await _read_raw_content(session_id, file_path)
    if raw is None:
        return {"success": False, "error": f"Could not read {file_path}", "file_path": file_path}

    count = raw.count(target_str)
    if count == 0:
        return {"success": False, "error": f"target_str not found in {file_path}", "file_path": file_path}
    if count > 1:
        return {"success": False, "error": f"Multiple occurrences ({count}) found — aborting", "file_path": file_path}

    new_content = raw.replace(target_str, "", 1)
    write_result = await sandbox_manager.write_file(session_id, file_path, new_content)
    if not write_result.get("success"):
        return {"success": False, "error": f"Write failed: {write_result.get('error')}", "file_path": file_path}

    return {
        "success": True,
        "message": f"Deleted text from {file_path}",
        "file_path": file_path,
        "target_str": target_str,
    }


# ---------------------------------------------------------------------------
# Tool registry — maps tool name → executor function
# ---------------------------------------------------------------------------

TOOL_EXECUTORS: Dict[str, Callable[..., Awaitable[dict]]] = {
    "file_write": execute_file_write,
    "file_read": execute_file_read,
    "shell": execute_shell,
    "replace_in_file": execute_replace_in_file,
    "insert_line": execute_insert_line,
    "delete_lines": execute_delete_lines,
    "delete_str": execute_delete_str,
}