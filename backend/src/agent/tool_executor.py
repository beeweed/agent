"""
Tool Executor — executes tool calls returned by the LLM API.

Each function takes validated arguments and a session files dictionary,
executes the action, and returns a structured result dict.

No prompt parsing. No manual routing. Called directly from the agent loop
after the API returns a structured tool_call object.
"""

from typing import Dict, Optional, Callable, Awaitable


# In-memory file storage per session: {session_id: {file_path: content}}
_session_files: Dict[str, Dict[str, str]] = {}


def _get_files(session_id: str) -> Dict[str, str]:
    if session_id not in _session_files:
        _session_files[session_id] = {}
    return _session_files[session_id]


# ---------------------------------------------------------------------------
# Individual tool executors
# ---------------------------------------------------------------------------

async def execute_file_write(session_id: str, arguments: dict) -> dict:
    file_path = arguments.get("file_path", "")
    content = arguments.get("content", "")
    files = _get_files(session_id)
    files[file_path] = content
    return {
        "success": True,
        "message": f"Successfully created/wrote file at {file_path}",
        "file_path": file_path,
        "content": content,
    }


async def execute_file_read(session_id: str, arguments: dict) -> dict:
    file_path = arguments.get("file_path", "")
    files = _get_files(session_id)
    if file_path not in files:
        return {
            "success": False,
            "error": f"File not found: {file_path}",
            "file_path": file_path,
        }
    content = files[file_path]
    lines = content.split('\n')
    formatted_lines = [f"{i+1:6d}\t{line}" for i, line in enumerate(lines)]
    formatted_content = '\n'.join(formatted_lines)
    return {
        "success": True,
        "content": formatted_content,
        "raw_content": content,
        "file_path": file_path,
        "file_name": file_path.split('/')[-1],
        "total_lines": len(lines),
        "lines_read": len(lines),
    }


async def _read_raw_content(session_id: str, file_path: str) -> Optional[str]:
    files = _get_files(session_id)
    return files.get(file_path)


async def execute_replace_in_file(session_id: str, arguments: dict) -> dict:
    file_path = arguments.get("file_path", "")
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
    files = _get_files(session_id)
    files[file_path] = new_content

    return {
        "success": True,
        "message": f"Replaced {occurrences} occurrence(s) in {file_path}",
        "file_path": file_path,
        "old_string": old_string,
        "new_string": new_string,
        "occurrences": occurrences,
        "new_content": new_content,
    }


# ---------------------------------------------------------------------------
# Tool registry — maps tool name → executor function
# ---------------------------------------------------------------------------

TOOL_EXECUTORS: Dict[str, Callable[..., Awaitable[dict]]] = {
    "file_write": execute_file_write,
    "file_read": execute_file_read,
    "replace_in_file": execute_replace_in_file,
}
