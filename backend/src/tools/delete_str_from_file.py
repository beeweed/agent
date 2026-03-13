"""
Delete String From File Tool - Delete a specific string/block from a file in E2B sandbox.

This tool allows the LLM to remove an exact string or code block from an existing file.
It performs exact-match deletion: no regex, no patterns, no approximations.
Designed for safe, deterministic text removal in AI coding agents.
"""

# Tool metadata
NAME = "delete_str_from_file"
DISPLAY_NAME = "deleting"


def delete_str_from_file(file_path: str, target_str: str, content: str) -> dict:
    """
    Delete a specific exact string from a file's content.

    This function searches for target_str in the provided content and removes it.
    Only a single unique occurrence is deleted. If there are multiple matches
    the operation is aborted to prevent ambiguous edits.

    Args:
        file_path: Path of the file (used in messages only).
        target_str: The exact text to remove from the file.
        content: The current full file content.

    Returns:
        A dictionary with:
        - success: Whether the deletion succeeded
        - new_content: The file content after deletion (if successful)
        - target_str: The string that was deleted
        - file_path: The file path
        - error: Error description (if failed)
    """
    try:
        if not file_path:
            return {
                "success": False,
                "error": "File path is required",
                "file_path": file_path,
            }

        if target_str is None or target_str == "":
            return {
                "success": False,
                "error": "target_str is required and must not be empty",
                "file_path": file_path,
            }

        if content is None:
            return {
                "success": False,
                "error": "File content is empty or could not be read",
                "file_path": file_path,
            }

        occurrences = content.count(target_str)

        if occurrences == 0:
            return {
                "success": False,
                "error": (
                    f"Could not find the specified text to delete in {file_path}. "
                    "The target_str was not found in the file."
                ),
                "file_path": file_path,
                "target_str": (
                    target_str[:100] + "..."
                    if len(target_str) > 100
                    else target_str
                ),
            }

        if occurrences > 1:
            return {
                "success": False,
                "error": (
                    f"Multiple matches ({occurrences}) found for target_str in {file_path}. "
                    "Deletion aborted to prevent unintended modifications. "
                    "Use delete_lines_from_file with exact line numbers instead."
                ),
                "file_path": file_path,
                "target_str": (
                    target_str[:100] + "..."
                    if len(target_str) > 100
                    else target_str
                ),
            }

        new_content = content.replace(target_str, "", 1)

        return {
            "success": True,
            "message": f"Successfully deleted the specified text from {file_path}",
            "file_path": file_path,
            "new_content": new_content,
            "target_str": target_str,
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file_path": file_path,
        }


# Tool definition for OpenAI/OpenRouter function calling
DELETE_STR_FROM_FILE_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "delete_str_from_file",
        "description": """Delete an exact string or code block from a file. Use this tool to safely remove a specific piece of text without modifying unrelated parts.

WHEN TO USE:
- Remove a specific line or block of code (e.g. a debug statement, an import, a comment)
- Delete configuration values, obsolete code, or redundant statements
- Clean up unused imports, temporary code, or duplicate lines
- Any situation where you know the exact text to remove

WHEN NOT TO USE (use other tools instead):
- When a line needs to be modified (use replace_in_file)
- When new content must be added (use insert_line)
- When you need to delete by line number (use delete_lines_from_file)
- When rewriting most of a file (use file_write)

HOW IT WORKS:
1. Read the file first to identify the exact text to remove
2. Provide the path and the exact target_str
3. The tool removes the first and only occurrence
4. If multiple matches exist the tool aborts — use delete_lines_from_file instead

IMPORTANT RULES:
- target_str must be an EXACT match (case-sensitive, whitespace-sensitive)
- Only one occurrence is allowed; multiple matches cause an abort
- The tool never modifies surrounding code
- Always use Read tool first to confirm the exact text

EXAMPLES:

Example 1 — Remove a debug log:
{
  "path": "/home/user/project/src/app.js",
  "target_str": "console.log('debug')"
}

Example 2 — Remove an import:
{
  "path": "/home/user/project/src/server.py",
  "target_str": "import unused_library"
}

Example 3 — Remove a multi-line block:
{
  "path": "/home/user/project/src/config.ts",
  "target_str": "// TODO: remove this\\nconst OLD_FLAG = true;"
}""",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute path to the file, e.g. /home/user/project/src/file.py. MUST start with /home/user/",
                },
                "target_str": {
                    "type": "string",
                    "description": "Exact string that should be deleted from the file. Must match exactly (case-sensitive, whitespace-sensitive).",
                },
            },
            "required": ["path", "target_str"],
        },
    },
}