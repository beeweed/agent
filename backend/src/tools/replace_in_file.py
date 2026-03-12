"""
Replace In File Tool - String replacement tool for editing files in E2B sandbox.

This tool allows the LLM to make targeted text replacements in existing files,
similar to how modern AI coding agents (Cursor, Claude Code) perform file edits.
"""

# Tool metadata
NAME = "replace_in_file"
DISPLAY_NAME = "Update file"


def replace_in_file(file_path: str, old_string: str, new_string: str, content: str) -> dict:
    """
    Replace a specific string inside a file content.
    
    This function performs the actual string replacement on the provided content.
    The sandbox file operations (read/write) are handled by the agent.
    
    Args:
        file_path: Path of the file (for error messages)
        old_string: Exact text that should be replaced
        new_string: New text that will replace the old text
        content: The current file content to perform replacement on
    
    Returns:
        A dictionary with the result of the operation including:
        - success: Whether the operation succeeded
        - new_content: The modified content (if successful)
        - old_string: The original string that was replaced
        - new_string: The new string that replaced it
        - occurrences: Number of occurrences replaced
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
        
        if old_string is None:
            return {
                "success": False,
                "error": "old_string is required",
                "file_path": file_path
            }
        
        if new_string is None:
            return {
                "success": False,
                "error": "new_string is required", 
                "file_path": file_path
            }
        
        if content is None:
            return {
                "success": False,
                "error": "File content is empty or could not be read",
                "file_path": file_path
            }
        
        # Check if old_string exists in the content
        occurrences = content.count(old_string)
        
        if occurrences == 0:
            return {
                "success": False,
                "error": f"Could not find the specified text to replace in {file_path}. The old_string was not found in the file.",
                "file_path": file_path,
                "old_string": old_string[:100] + "..." if len(old_string) > 100 else old_string
            }
        
        # Perform the replacement
        new_content = content.replace(old_string, new_string)
        
        return {
            "success": True,
            "message": f"Successfully replaced {occurrences} occurrence(s) in {file_path}",
            "file_path": file_path,
            "new_content": new_content,
            "old_string": old_string,
            "new_string": new_string,
            "occurrences": occurrences
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "file_path": file_path
        }


# Tool definition for OpenAI/OpenRouter function calling
REPLACE_IN_FILE_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "replace_in_file",
        "description": """Replace a specific string inside a file. Use this tool to make targeted edits to existing files without rewriting the entire file.

WHEN TO USE:
- When you need to modify a small part of an existing file
- When you want to update specific code, configuration, or text
- When fixing bugs by changing specific lines
- When refactoring variable names or function signatures
- When updating imports, dependencies, or configuration values

HOW IT WORKS:
1. Provide the file_path of the file to edit
2. Provide old_string - the EXACT text currently in the file that you want to replace
3. Provide new_string - the text that will replace old_string

IMPORTANT RULES:
- old_string must be an EXACT match of text in the file (including whitespace, indentation)
- The tool replaces ALL occurrences of old_string with new_string
- Use file_write tool instead if you need to create a new file or rewrite most of a file
- Use Read tool first if you're unsure about the exact content to replace

EXAMPLES:

Example 1 - Change a port number:
{
  "file_path": "/home/user/project/config.js",
  "old_string": "const port = 3000",
  "new_string": "const port = 5000"
}

Example 2 - Fix a typo in code:
{
  "file_path": "/home/user/project/src/App.tsx",
  "old_string": "console.log('Helllo World')",
  "new_string": "console.log('Hello World')"
}

Example 3 - Update an import:
{
  "file_path": "/home/user/project/src/index.ts",
  "old_string": "import { oldFunction } from './utils'",
  "new_string": "import { newFunction } from './utils'"
}

Example 4 - Multi-line replacement:
{
  "file_path": "/home/user/project/src/component.tsx",
  "old_string": "function Button() {\\n  return <button>Click</button>\\n}",
  "new_string": "function Button({ label }: { label: string }) {\\n  return <button>{label}</button>\\n}"
}""",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path of the file where replacement should happen. MUST start with /home/user/. Example: /home/user/project/src/App.tsx"
                },
                "old_string": {
                    "type": "string",
                    "description": "Exact text that should be replaced. Must match exactly what is in the file, including whitespace and indentation."
                },
                "new_string": {
                    "type": "string",
                    "description": "New text that will replace the old text. Can be empty string to delete the old_string."
                }
            },
            "required": ["file_path", "old_string", "new_string"]
        }
    }
}