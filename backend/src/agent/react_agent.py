"""
ReAct Agent — Native Function Calling Implementation.

Architecture:
  User Input
    → LLM API call (with tool schemas)
    → LLM returns structured tool_call (or final text)
    → Execute tool directly via tool_executor
    → Return result to LLM as tool message
    → Repeat until LLM returns final answer (no tool call)

ZERO prompt-based tool calling. ZERO manual parsing.
Tools are defined as structured schemas sent to the API.
The LLM decides tool usage via API protocol, not prompt tricks.
"""

import json
import re
import asyncio
from typing import AsyncGenerator, Optional, Callable

from .models import ContextWindow
from .system_prompt import get_system_prompt
from .tool_schemas import TOOL_SCHEMAS
from .tool_executor import TOOL_EXECUTORS
from ..services.openrouter import chat_completion
from ..services.e2b_sandbox import sandbox_manager


class StreamingToolParser:
    """Accumulates streaming chunks and extracts tool calls / content."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.tool_calls: dict[int, dict] = {}
        self.current_content = ""
        self.finished = False

    def process_chunk(self, chunk: dict) -> dict:
        result = {
            "content_delta": "",
            "tool_updates": {},
            "finish_reason": None,
        }

        choices = chunk.get("choices", [])
        if not choices:
            return result

        choice = choices[0]
        delta = choice.get("delta", {})
        result["finish_reason"] = choice.get("finish_reason")

        if delta.get("content"):
            result["content_delta"] = delta["content"]
            self.current_content += delta["content"]

        for tc in delta.get("tool_calls", []):
            index = tc.get("index", 0)
            tool_id = tc.get("id")

            if index not in self.tool_calls:
                self.tool_calls[index] = {"id": tool_id or f"call_{index}", "name": "", "arguments": ""}
            if tool_id:
                self.tool_calls[index]["id"] = tool_id

            fn = tc.get("function", {})
            if "name" in fn:
                self.tool_calls[index]["name"] = fn["name"]
            if "arguments" in fn:
                args_delta = fn["arguments"]
                self.tool_calls[index]["arguments"] += args_delta
                result["tool_updates"][index] = {
                    "id": self.tool_calls[index]["id"],
                    "name": self.tool_calls[index]["name"],
                    "arguments_delta": args_delta,
                    "arguments_so_far": self.tool_calls[index]["arguments"],
                }

        return result

    def get_parsed_tool_calls(self) -> list:
        parsed = []
        for index in sorted(self.tool_calls.keys()):
            tc = self.tool_calls[index]
            try:
                arguments = json.loads(tc["arguments"])
            except json.JSONDecodeError:
                arguments = {}
            parsed.append({
                "id": tc["id"],
                "function": {"name": tc["name"], "arguments": tc["arguments"]},
                "parsed_arguments": arguments,
            })
        return parsed


class ContentStreamExtractor:
    """Extracts `content` field in real-time from streaming JSON arguments (for file_write)."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.content_extracted = ""
        self.escape_next = False
        self.file_path = ""
        self.file_path_extracted = False

    def _extract_file_path(self, json_str: str) -> str:
        match = re.search(r'"file_path"\s*:\s*"([^"]*)"', json_str)
        return match.group(1) if match else ""

    def process_delta(self, arguments_so_far: str) -> tuple[str, str]:
        if not self.file_path_extracted:
            self.file_path = self._extract_file_path(arguments_so_far)
            if self.file_path:
                self.file_path_extracted = True

        content_match = re.search(r'"content"\s*:\s*"', arguments_so_far)
        if not content_match:
            return "", self.file_path

        start_idx = content_match.end()
        new_content = ""
        i = start_idx + len(self.content_extracted)

        while i < len(arguments_so_far):
            char = arguments_so_far[i]
            if self.escape_next:
                esc_map = {"n": "\n", "t": "\t", "r": "\r", "\\": "\\", '"': '"', "/": "/"}
                new_content += esc_map.get(char, char)
                self.escape_next = False
            elif char == "\\":
                self.escape_next = True
            elif char == '"':
                break
            else:
                new_content += char
            i += 1

        self.content_extracted += new_content
        return new_content, self.file_path


class ReActAgent:
    """
    Native function-calling ReAct agent.

    The loop:
      1. Send messages + tool schemas to LLM API
      2. LLM returns either:
         a) A tool_call → execute it, append tool result, loop
         b) Final text   → emit complete, stop
      3. One tool call per iteration (sequential execution)
    """

    def __init__(
        self,
        api_key: str,
        model: str = "anthropic/claude-3.5-sonnet",
        max_iterations: int = 500,
        e2b_api_key: str = "",
        session_id: str = "default",
        e2b_template_id: str = "",
    ):
        self.api_key = api_key
        self.model = model
        self.max_iterations = max_iterations
        self.e2b_api_key = e2b_api_key
        self.e2b_template_id = e2b_template_id
        self.context = ContextWindow()
        self.current_iteration = 0
        self.is_running = False
        self.session_id = session_id
        self.sandbox_ready = False

    # ------------------------------------------------------------------
    # Sandbox lifecycle
    # ------------------------------------------------------------------

    async def ensure_sandbox(self) -> dict:
        if not self.e2b_api_key:
            return {"success": False, "error": "E2B API key not configured"}

        status = await sandbox_manager.get_sandbox_status(self.session_id)
        if status.get("exists") and status.get("is_running"):
            self.sandbox_ready = True
            return {"success": True, "message": "Sandbox already running"}

        result = await sandbox_manager.create_sandbox(
            self.session_id,
            self.e2b_api_key,
            timeout=300,
            template_id=self.e2b_template_id,
        )
        if result.get("success"):
            self.sandbox_ready = True
        return result

    # ------------------------------------------------------------------
    # Message helpers
    # ------------------------------------------------------------------

    def _get_messages(self) -> list:
        return [{"role": "system", "content": get_system_prompt()}] + self.context.get_messages()

    # ------------------------------------------------------------------
    # Main agent loop
    # ------------------------------------------------------------------

    async def run(self, user_message: str, on_event: Optional[Callable] = None) -> AsyncGenerator:
        self.is_running = True
        self.current_iteration = 0

        # --- Sandbox setup ---
        yield {"type": "sandbox_creating", "message": "Creating sandbox..."}
        sandbox_result = await self.ensure_sandbox()
        if not sandbox_result.get("success"):
            yield {"type": "sandbox_error", "error": sandbox_result.get("error", "Failed to create sandbox")}
            self.is_running = False
            return
        yield {"type": "sandbox_ready", "message": "Sandbox ready"}

        self.context.add_user_message(user_message)
        yield {"type": "iteration_start", "iteration": 0, "max_iterations": self.max_iterations}

        try:
            while self.is_running and self.current_iteration < self.max_iterations:
                self.current_iteration += 1
                yield {"type": "iteration", "iteration": self.current_iteration, "max_iterations": self.max_iterations}

                messages = self._get_messages()

                # --- Stream LLM response (with native tool schemas) ---
                parser = StreamingToolParser()
                content_extractors: dict[int, ContentStreamExtractor] = {}
                accumulated_content = ""
                has_tool_calls = False
                finish_reason = None
                streaming_started: dict[int, bool] = {}
                thought_stream_started = False

                async for chunk_event in chat_completion(
                    api_key=self.api_key,
                    model=self.model,
                    messages=messages,
                    tools=TOOL_SCHEMAS,
                    stream=True,
                ):
                    if chunk_event.get("type") == "error":
                        yield {"type": "error", "error": chunk_event.get("error", "Unknown error")}
                        self.is_running = False
                        return

                    if chunk_event.get("type") == "done":
                        break

                    if chunk_event.get("type") != "chunk":
                        continue

                    parsed = parser.process_chunk(chunk_event["data"])

                    # --- Stream thought/content tokens ---
                    if parsed["content_delta"]:
                        accumulated_content += parsed["content_delta"]
                        if not thought_stream_started:
                            thought_stream_started = True
                            yield {"type": "thought_stream_start", "iteration": self.current_iteration}
                        yield {"type": "thought_stream_chunk", "chunk": parsed["content_delta"], "iteration": self.current_iteration}

                    if parsed["finish_reason"]:
                        finish_reason = parsed["finish_reason"]

                    # --- Stream file_write content in real-time ---
                    for index, update in parsed["tool_updates"].items():
                        has_tool_calls = True
                        if update["name"] == "file_write":
                            if index not in content_extractors:
                                content_extractors[index] = ContentStreamExtractor()
                            extractor = content_extractors[index]
                            content_delta, file_path = extractor.process_delta(update["arguments_so_far"])

                            if file_path and index not in streaming_started:
                                streaming_started[index] = True
                                yield {
                                    "type": "code_stream_start",
                                    "tool_id": update["id"],
                                    "tool_name": "file_write",
                                    "file_path": file_path,
                                    "iteration": self.current_iteration,
                                }
                            if content_delta:
                                yield {
                                    "type": "code_stream_chunk",
                                    "tool_id": update["id"],
                                    "chunk": content_delta,
                                    "file_path": file_path,
                                    "iteration": self.current_iteration,
                                }

                # --- End thought stream ---
                if thought_stream_started:
                    yield {"type": "thought_stream_end", "content": accumulated_content, "iteration": self.current_iteration}
                elif accumulated_content:
                    yield {"type": "thought", "content": accumulated_content, "iteration": self.current_iteration}

                # === TOOL CALLS: Execute each tool returned by the API ===
                if has_tool_calls:
                    tool_calls = parser.get_parsed_tool_calls()

                    # Record assistant message with tool_calls in context
                    formatted_tc = [
                        {"id": tc["id"], "function": tc["function"], "type": "function"}
                        for tc in tool_calls
                    ]
                    self.context.add_tool_call(formatted_tc, accumulated_content)

                    for i, tc in enumerate(tool_calls):
                        tool_name = tc["function"]["name"]
                        tool_id = tc["id"]
                        arguments = tc["parsed_arguments"]

                        # End code streaming for file_write
                        if i in streaming_started:
                            yield {
                                "type": "code_stream_end",
                                "tool_id": tool_id,
                                "tool_name": tool_name,
                                "file_path": arguments.get("file_path", ""),
                                "iteration": self.current_iteration,
                            }

                        # Emit tool_call event
                        yield {
                            "type": "tool_call",
                            "tool_name": tool_name,
                            "tool_id": tool_id,
                            "arguments": arguments,
                            "iteration": self.current_iteration,
                        }

                        # --- Emit tool-specific start events for frontend ---
                        for evt in self._emit_tool_start_events(tool_name, tool_id, arguments):
                            yield evt

                        # --- Execute tool ---
                        if tool_name in TOOL_EXECUTORS:
                            result = await TOOL_EXECUTORS[tool_name](self.session_id, arguments)
                        else:
                            result = {"success": False, "error": f"Unknown tool: {tool_name}"}

                        result_str = json.dumps(result)
                        self.context.add_tool_result(tool_id, tool_name, result_str)

                        # --- Emit tool-specific end events for frontend ---
                        for evt in self._emit_tool_end_events(tool_name, tool_id, arguments, result):
                            yield evt

                        # Generic tool_result event
                        yield {
                            "type": "tool_result",
                            "tool_name": tool_name,
                            "tool_id": tool_id,
                            "result": result,
                            "iteration": self.current_iteration,
                        }

                # === FINAL ANSWER: No tool calls, model returned text ===
                elif accumulated_content and finish_reason == "stop":
                    self.context.add_assistant_message(accumulated_content)
                    yield {
                        "type": "complete",
                        "content": accumulated_content,
                        "iteration": self.current_iteration,
                        "total_iterations": self.current_iteration,
                    }
                    self.is_running = False
                    break

                elif not has_tool_calls and not accumulated_content:
                    yield {
                        "type": "complete",
                        "content": "Task completed.",
                        "iteration": self.current_iteration,
                        "total_iterations": self.current_iteration,
                    }
                    self.is_running = False
                    break

                await asyncio.sleep(0.05)

            if self.current_iteration >= self.max_iterations:
                yield {
                    "type": "max_iterations_reached",
                    "iteration": self.current_iteration,
                    "max_iterations": self.max_iterations,
                    "message": "Maximum iterations reached.",
                }

        except Exception as e:
            yield {"type": "error", "error": str(e), "iteration": self.current_iteration}
        finally:
            self.is_running = False

    # ------------------------------------------------------------------
    # Frontend event emitters (maintain same SSE types the UI expects)
    # ------------------------------------------------------------------

    def _emit_tool_start_events(self, tool_name: str, tool_id: str, arguments: dict):
        """Yield start events so frontend can show appropriate UI cards."""
        it = self.current_iteration

        if tool_name == "file_read":
            yield {
                "type": "read_file_start",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "iteration": it,
            }
        elif tool_name == "replace_in_file":
            yield {
                "type": "replace_in_file_start",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "old_string": arguments.get("old_string", ""),
                "new_string": arguments.get("new_string", ""),
                "iteration": it,
            }
        elif tool_name == "insert_line":
            yield {
                "type": "insert_line_start",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "insert_line": arguments.get("insert_line", 0),
                "new_str": arguments.get("new_str", ""),
                "iteration": it,
            }
        elif tool_name == "delete_lines":
            yield {
                "type": "delete_lines_start",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "target_line": arguments.get("target_line", 0),
                "iteration": it,
            }
        elif tool_name == "delete_str":
            yield {
                "type": "delete_str_from_file_start",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "target_str": arguments.get("target_str", ""),
                "iteration": it,
            }

    def _emit_tool_end_events(self, tool_name: str, tool_id: str, arguments: dict, result: dict):
        """Yield end events so frontend can update UI cards with results."""
        it = self.current_iteration

        if tool_name == "file_read":
            yield {
                "type": "read_file_end",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "result": result,
                "iteration": it,
            }
        elif tool_name == "replace_in_file":
            yield {
                "type": "replace_in_file_end",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "old_string": arguments.get("old_string", ""),
                "new_string": arguments.get("new_string", ""),
                "result": result,
                "iteration": it,
            }
        elif tool_name == "insert_line":
            yield {
                "type": "insert_line_end",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "insert_line": arguments.get("insert_line", 0),
                "new_str": arguments.get("new_str", ""),
                "result": result,
                "iteration": it,
            }
        elif tool_name == "delete_lines":
            yield {
                "type": "delete_lines_end",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "target_line": arguments.get("target_line", 0),
                "result": result,
                "iteration": it,
            }
        elif tool_name == "delete_str":
            yield {
                "type": "delete_str_from_file_end",
                "tool_id": tool_id,
                "tool_name": tool_name,
                "file_path": arguments.get("file_path", ""),
                "target_str": arguments.get("target_str", ""),
                "result": result,
                "iteration": it,
            }

    # ------------------------------------------------------------------
    # Control
    # ------------------------------------------------------------------

    def stop(self):
        self.is_running = False

    async def reset(self):
        self.context.clear()
        self.current_iteration = 0
        self.is_running = False

    def get_memory(self) -> dict:
        stats = self.context.get_stats()
        return {
            "session_id": self.session_id,
            "current_iteration": self.current_iteration,
            "max_iterations": self.max_iterations,
            "is_running": self.is_running,
            "messages": self.context.get_messages(),
            "stats": stats,
        }