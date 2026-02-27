import os
from typing import Any

# Constants
MAX_FILE_READ_LINES = 5000
MAX_LINE_LENGTH = 5000

# Tool metadata
NAME = "Read"
DISPLAY_NAME = "Read file"


def file_read(file_path: str) -> dict:
    """
    Reads and returns the content of a specified file from the local filesystem.
    Supports text files with line number formatting.

    Args:
        file_path: Absolute path of the file to read

    Returns:
        A dictionary with the result of the operation including file content
    """
    try:
        # Validate file path
        if not file_path:
            return {
                "success": False,
                "error": "File path is required",
                "file_path": file_path
            }

        # Normalize the path
        safe_path = os.path.abspath(file_path)

        # Check if file exists
        if not os.path.exists(safe_path):
            return {
                "success": False,
                "error": f"File not found: {file_path}",
                "file_path": file_path
            }

        # Check if it's a file (not a directory)
        if not os.path.isfile(safe_path):
            return {
                "success": False,
                "error": f"Path is not a file: {file_path}",
                "file_path": file_path
            }

        # Get file size for info
        file_size = os.path.getsize(safe_path)

        # Read file content with line limiting
        lines = []
        total_lines = 0
        truncated = False

        try:
            with open(safe_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    total_lines = line_num

                    if line_num > MAX_FILE_READ_LINES:
                        truncated = True
                        break

                    # Truncate long lines
                    if len(line) > MAX_LINE_LENGTH:
                        line = line[:MAX_LINE_LENGTH] + "... [line truncated]"

                    # Format with line number (cat -n style)
                    lines.append(f"{line_num:6d}\t{line.rstrip()}")

        except UnicodeDecodeError:
            # Try reading as binary and decode with error handling
            with open(safe_path, 'rb') as f:
                raw_content = f.read()
                try:
                    content = raw_content.decode('utf-8', errors='replace')
                    for line_num, line in enumerate(content.split('\n'), 1):
                        total_lines = line_num

                        if line_num > MAX_FILE_READ_LINES:
                            truncated = True
                            break

                        if len(line) > MAX_LINE_LENGTH:
                            line = line[:MAX_LINE_LENGTH] + "... [line truncated]"

                        lines.append(f"{line_num:6d}\t{line.rstrip()}")

                except Exception:
                    return {
                        "success": False,
                        "error": "Unable to read file: binary or unsupported encoding",
                        "file_path": file_path
                    }

        # Build formatted content
        formatted_content = '\n'.join(lines)

        # Get file extension for language detection
        file_extension = os.path.splitext(safe_path)[1].lower()
        file_name = os.path.basename(safe_path)

        result = {
            "success": True,
            "content": formatted_content,
            "file_path": file_path,
            "file_name": file_name,
            "file_extension": file_extension,
            "file_size": file_size,
            "total_lines": total_lines,
            "lines_read": len(lines),
            "truncated": truncated
        }

        if truncated:
            result["message"] = f"File truncated: showing first {MAX_FILE_READ_LINES} of {total_lines} lines"

        return result

    except PermissionError:
        return {
            "success": False,
            "error": f"Permission denied: {file_path}",
            "file_path": file_path
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file_path": file_path
        }


# Tool definition for OpenAI/OpenRouter function calling
FILE_READ_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "Read",
        "description": f"""Reads and returns the content of a specified file from the local filesystem. Supports text files.

Usage:
- file_path must be an absolute path
- Reads up to {MAX_FILE_READ_LINES} lines with line numbers (cat -n format)
- Lines longer than {MAX_LINE_LENGTH} chars are truncated
- Returns formatted content with line numbers starting at 1

Use this tool when you need to:
- Read existing files to understand their content
- Check the current state of a file before making changes
- Analyze code or configuration files
- Review file contents for debugging or understanding""",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Absolute path of the file to read. Example: /workspace/project/src/main.py, /etc/hosts, /workspace/vibe-coder/virtual_fs/package.json"
                }
            },
            "required": ["file_path"]
        }
    }
}