"""
Insert Line Tool - Insert new content into a file at a specific line number.

This tool allows the LLM to insert new lines of code into existing files
without modifying or deleting any existing content. It is designed for
AI coding agents when new code needs to be added to an existing file.
"""

# Tool metadata
NAME = "insert_line"
DISPLAY_NAME = "Insert lines"


def insert_line(file_path: str, insert_line: int, new_str: str, content: str) -> dict:
    """
    Insert new content into a file after a specific line number.
    
    This function performs the actual insertion on the provided content.
    The sandbox file operations (read/write) are handled by the agent.
    
    Args:
        file_path: Path of the file (for error messages)
        insert_line: Line number after which the new content should be inserted
        new_str: The new content to insert
        content: The current file content to perform insertion on
    
    Returns:
        A dictionary with the result of the operation including:
        - success: Whether the operation succeeded
        - new_content: The modified content (if successful)
        - insert_line: The line number after which content was inserted
        - new_str: The content that was inserted
        - lines_inserted: Number of lines inserted
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
        
        if insert_line is None or insert_line < 0:
            return {
                "success": False,
                "error": "insert_line must be a non-negative integer",
                "file_path": file_path
            }
        
        if new_str is None:
            return {
                "success": False,
                "error": "new_str is required",
                "file_path": file_path
            }
        
        if content is None:
            return {
                "success": False,
                "error": "File content is empty or could not be read",
                "file_path": file_path
            }
        
        # Split the content into lines
        lines = content.split('\n')
        total_lines = len(lines)
        
        # Validate insert_line is within bounds
        if insert_line > total_lines:
            return {
                "success": False,
                "error": f"insert_line ({insert_line}) exceeds total lines in file ({total_lines})",
                "file_path": file_path
            }
        
        # Split the new content into lines for counting
        new_lines = new_str.split('\n')
        lines_inserted = len(new_lines)
        
        # Insert the new content after the specified line
        # If insert_line is 0, insert at the beginning
        if insert_line == 0:
            new_content = new_str + '\n' + content
        else:
            # Insert after the specified line
            before = '\n'.join(lines[:insert_line])
            after = '\n'.join(lines[insert_line:])
            
            if after:
                new_content = before + '\n' + new_str + '\n' + after
            else:
                new_content = before + '\n' + new_str
        
        return {
            "success": True,
            "message": f"Successfully inserted {lines_inserted} line(s) after line {insert_line} in {file_path}",
            "file_path": file_path,
            "new_content": new_content,
            "insert_line": insert_line,
            "new_str": new_str,
            "lines_inserted": lines_inserted
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file_path": file_path
        }


# Tool definition for OpenAI/OpenRouter function calling
INSERT_LINE_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "insert_line",
        "description": """Insert new content into a file after a specific line number. Use this tool to add new code or text to an existing file without modifying or deleting any existing content.

WHEN TO USE:
- When you need to add new code to an existing file
- When adding logging statements or debug output
- When adding new imports at the beginning of a file
- When adding new functions, methods, or classes
- When inserting configuration lines or initialization code
- When you want to extend a file by adding content at a specific location

WHEN NOT TO USE (use other tools instead):
- When you need to replace existing text (use replace_in_file)
- When you need to delete lines (use replace_in_file with empty new_string)
- When creating a new file (use file_write)
- When rewriting most of a file's content (use file_write)

HOW IT WORKS:
1. Provide the file_path of the file to edit
2. Provide insert_line - the line number AFTER which the new content will be inserted
3. Provide new_str - the exact content to insert

IMPORTANT RULES:
- insert_line is the line number AFTER which content will be inserted
- Use insert_line = 0 to insert at the very beginning of the file
- The tool ONLY inserts content - it never modifies or deletes existing lines
- Use Read tool first to determine the correct line number for insertion

EXAMPLES:

Example 1 - Add an import at the beginning of a file:
{
  "file_path": "/home/user/project/src/app.py",
  "insert_line": 0,
  "new_str": "import logging"
}

Example 2 - Add a print statement after line 5:
{
  "file_path": "/home/user/project/src/app.py",
  "insert_line": 5,
  "new_str": "print('Server started successfully')"
}

Example 3 - Add multiple lines after line 10:
{
  "file_path": "/home/user/project/src/config.js",
  "insert_line": 10,
  "new_str": "// New configuration\\nconst DEBUG = true;\\nconst LOG_LEVEL = 'info';"
}

Example 4 - Add a new function after line 20:
{
  "file_path": "/home/user/project/src/utils.ts",
  "insert_line": 20,
  "new_str": "function validateInput(input: string): boolean {\\n  return input.length > 0;\\n}"
}""",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Absolute path to the file where content should be inserted, e.g. /home/user/project/src/app.py. MUST start with /home/user/"
                },
                "insert_line": {
                    "type": "integer",
                    "description": "Line number AFTER which the new content should be inserted. Use 0 to insert at the beginning of the file."
                },
                "new_str": {
                    "type": "string",
                    "description": "The new content that should be inserted into the file. Can be single or multiple lines (use \\n for newlines)."
                }
            },
            "required": ["file_path", "insert_line", "new_str"]
        }
    }
}