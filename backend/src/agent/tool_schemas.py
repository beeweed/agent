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
            "description": "Create or overwrite a file at the given path inside the sandbox. Use for creating new files or fully rewriting existing ones.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path starting with /home/user/. Example: /home/user/project/src/App.tsx"
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
            "description": "Read the content of an existing file from the sandbox. Returns content with line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path starting with /home/user/. Example: /home/user/project/src/main.py"
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
                        "description": "Absolute path starting with /home/user/."
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
    {
        "type": "function",
        "function": {
            "name": "insert_line",
            "description": "Insert new content into an existing file after a specific line number. Only inserts — never modifies or deletes existing lines.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path starting with /home/user/."
                    },
                    "insert_line": {
                        "type": "integer",
                        "description": "Line number AFTER which content is inserted. Use 0 for beginning of file."
                    },
                    "new_str": {
                        "type": "string",
                        "description": "Content to insert. Use \\n for multiple lines."
                    }
                },
                "required": ["file_path", "insert_line", "new_str"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_lines",
            "description": "Delete specific lines from a file by line number or range. Line numbers are 1-based.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path starting with /home/user/."
                    },
                    "target_line": {
                        "type": ["integer", "string"],
                        "description": "Line number (e.g. 15) or range (e.g. '20-22') to delete. 1-based."
                    }
                },
                "required": ["file_path", "target_line"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_str",
            "description": "Delete a specific exact string from a file. Only works if there is exactly one occurrence. Aborts if multiple matches found.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Absolute path starting with /home/user/."
                    },
                    "target_str": {
                        "type": "string",
                        "description": "Exact text to delete (case-sensitive, whitespace-sensitive)."
                    }
                },
                "required": ["file_path", "target_str"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "shell",
            "description": "Execute a shell command in a persistent named terminal session inside the sandbox. Commands run in the real terminal visible to the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_name": {
                        "type": "string",
                        "description": "Unique session identifier for terminal instance."
                    },
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute."
                    },
                    "description": {
                        "type": "string",
                        "description": "5-10 word explanation of command purpose."
                    },
                    "wait_for_output": {
                        "type": "boolean",
                        "description": "Wait for completion or run in background.",
                        "default": True
                    }
                },
                "required": ["session_name", "command", "description"]
            }
        }
    },
]