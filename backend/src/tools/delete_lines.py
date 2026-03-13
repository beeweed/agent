"""
Delete Lines From File Tool - Delete specific lines from a file in E2B sandbox.

This tool allows the LLM to delete specific lines from existing files
using an exact line number or a line range. It is designed for
AI coding agents when unwanted code or text needs to be removed.
"""

# Tool metadata
NAME = "delete_lines_from_file"
DISPLAY_NAME = "delete"


def delete_lines_from_file(file_path: str, target_line, content: str) -> dict:
    """
    Delete specific lines from a file.

    This function performs the actual deletion on the provided content.
    The sandbox file operations (read/write) are handled by the agent.

    Args:
        file_path: Path of the file (for error messages)
        target_line: Line number (int) or line range string (e.g. '20-22') to delete.
                     Line numbers are 1-based.
        content: The current file content to perform deletion on

    Returns:
        A dictionary with the result of the operation including:
        - success: Whether the operation succeeded
        - new_content: The modified content (if successful)
        - deleted_lines: The actual text of lines that were deleted
        - start_line / end_line: The range that was deleted
        - lines_deleted: Number of lines deleted
        - error: Error message (if failed)
    """
    try:
        # Validate inputs
        if not file_path:
            return {
                "success": False,
                "error": "File path is required",
                "file_path": file_path
            }

        if target_line is None:
            return {
                "success": False,
                "error": "target_line is required",
                "file_path": file_path
            }

        if content is None:
            return {
                "success": False,
                "error": "File content is empty or could not be read",
                "file_path": file_path
            }

        # Parse target_line into start and end
        if isinstance(target_line, int):
            start_line = target_line
            end_line = target_line
        elif isinstance(target_line, str):
            target_line = target_line.strip()
            if '-' in target_line:
                parts = target_line.split('-', 1)
                try:
                    start_line = int(parts[0].strip())
                    end_line = int(parts[1].strip())
                except ValueError:
                    return {
                        "success": False,
                        "error": f"Invalid line range format: '{target_line}'. Use a number (e.g. 15) or range (e.g. '20-22').",
                        "file_path": file_path
                    }
            else:
                try:
                    start_line = int(target_line)
                    end_line = start_line
                except ValueError:
                    return {
                        "success": False,
                        "error": f"Invalid target_line value: '{target_line}'. Use a number (e.g. 15) or range (e.g. '20-22').",
                        "file_path": file_path
                    }
        else:
            return {
                "success": False,
                "error": f"target_line must be an integer or string, got {type(target_line).__name__}",
                "file_path": file_path
            }

        # Validate range
        if start_line < 1:
            return {
                "success": False,
                "error": f"start_line must be >= 1, got {start_line}",
                "file_path": file_path
            }

        if end_line < start_line:
            return {
                "success": False,
                "error": f"end_line ({end_line}) must be >= start_line ({start_line})",
                "file_path": file_path
            }

        # Split content into lines
        lines = content.split('\n')
        total_lines = len(lines)

        if start_line > total_lines:
            return {
                "success": False,
                "error": f"start_line ({start_line}) exceeds total lines in file ({total_lines})",
                "file_path": file_path
            }

        if end_line > total_lines:
            return {
                "success": False,
                "error": f"end_line ({end_line}) exceeds total lines in file ({total_lines})",
                "file_path": file_path
            }

        # Extract the lines to be deleted (for reporting) — 1-based to 0-based
        deleted_lines_list = lines[start_line - 1 : end_line]
        deleted_text = '\n'.join(deleted_lines_list)
        lines_deleted = end_line - start_line + 1

        # Build new content without the deleted lines
        remaining = lines[:start_line - 1] + lines[end_line:]
        new_content = '\n'.join(remaining)

        return {
            "success": True,
            "message": f"Successfully deleted {lines_deleted} line(s) ({start_line}-{end_line}) from {file_path}",
            "file_path": file_path,
            "new_content": new_content,
            "deleted_lines": deleted_text,
            "start_line": start_line,
            "end_line": end_line,
            "lines_deleted": lines_deleted
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file_path": file_path
        }


# Tool definition for OpenAI/OpenRouter function calling
DELETE_LINES_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "delete_lines_from_file",
        "description": """Delete specific lines from a file using an exact line number or a line range. Use this tool to safely remove unwanted code or text without modifying other parts of the file.

WHEN TO USE:
- When a specific line of code needs to be removed
- When multiple consecutive lines must be deleted
- When refactoring requires removing outdated or unused code
- When fixing errors that require removing lines
- When cleaning up imports, comments, or dead code

WHEN NOT TO USE (use other tools instead):
- When you need to replace text (use replace_in_file)
- When you need to add new lines (use insert_line)
- When creating a new file (use file_write)
- When rewriting most of a file (use file_write)

HOW IT WORKS:
1. Use the Read tool first to see the file with line numbers
2. Identify the exact line number(s) to delete
3. Call this tool with the file path and target line(s)

IMPORTANT RULES:
- Line numbers are 1-based (the first line of the file is line 1)
- Always use the Read tool first to verify the correct line numbers before calling this tool
- Never guess line numbers — always verify by reading the file
- Avoid deleting large ranges unless clearly necessary

EXAMPLES:

Example 1 — Delete a single line (line 15):
{
  "path": "/home/user/project/src/app.py",
  "target_line": 15
}

Example 2 — Delete a range of lines (lines 20 through 22):
{
  "path": "/home/user/project/src/app.py",
  "target_line": "20-22"
}

Example 3 — Delete one import line (line 3):
{
  "path": "/home/user/project/src/utils.ts",
  "target_line": 3
}""",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute path to the file, e.g. /home/user/project/src/file.py. MUST start with /home/user/"
                },
                "target_line": {
                    "type": ["integer", "string"],
                    "description": "Line number to delete (e.g. 15) or line range to delete (e.g. '20-22'). Line numbers are 1-based."
                }
            },
            "required": ["path", "target_line"]
        }
    }
}