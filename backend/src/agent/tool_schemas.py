"""
Native Tool Schemas for OpenRouter/OpenAI Function Calling API.

These schemas are sent directly to the LLM via the API `tools` parameter.
The LLM never sees these as text — they are part of the API protocol.
The model decides when and how to call tools based on structured schemas.

ZERO prompt-based tool calling. ZERO manual parsing.
"""

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "file_write",
            "description": "Create or overwrite a file at the given path. Use for creating new files or fully rewriting existing ones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path for the file. Example: /project/src/App.tsx"
                    },
                    "content": {
                        "type": "string",
                        "description": "The full content to write to the file."
                    }
                },
                "required": ["file_path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "file_read",
            "description": "Read the content of an existing file. Returns content with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path of the file. Example: /project/src/main.py"
                    }
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "replace_in_file",
            "description": "Replace an exact string occurrence in an existing file. Use for targeted edits: fixing bugs, renaming, updating imports. The old_string must match exactly (whitespace-sensitive).",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path of the file."
                    },
                    "old_string": {
                        "type": "string",
                        "description": "Exact text currently in the file to be replaced."
                    },
                    "new_string": {
                        "type": "string",
                        "description": "Replacement text. Can be empty to delete old_string."
                    }
                },
                "required": ["file_path", "old_string", "new_string"]
            }
        }
    },
    ]