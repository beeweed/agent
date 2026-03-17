import json
import asyncio
import uuid
from dataclasses import dataclass
from typing import AsyncGenerator, Optional

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)

from .file_system import write_file, read_file, get_file_tree
from .schemas import AgentEvent, AgentEventType


SYSTEM_PROMPT = """\
You are a powerful autonomous General AI Agent capable of completing any task. You operate in a REACT (Reasoning + Acting) loop:

1. REASON: Analyze the current goal and state. Think step-by-step about what needs to be done.
2. ACT: Use your available tools to make progress toward the goal.
3. OBSERVE: Review the results of your actions.
4. REPEAT: Continue until the goal is fully achieved.

You have access to a file_write tool that lets you create and write files to a persistent workspace. You can create any type of file: code, documentation, configuration, data files, scripts, HTML, CSS, JSON, etc.

When given a task:
- Break it down into concrete steps
- Create all necessary files to accomplish the goal
- Write clean, well-structured, production-quality content
- If building a project, create proper file structures with all required files
- Always aim for completeness - create ALL files needed, not just the main ones

You are autonomous - you do not need to ask for clarification. Make reasonable decisions and proceed with the task. When the task is complete, provide a summary of what you accomplished.

IMPORTANT: You MUST use the file_write tool to create files. Do NOT just describe what files should contain - actually write them using the tool. Each tool call should create one file with its complete content.
"""


@dataclass
class AgentDeps:
    session_id: str
    event_queue: asyncio.Queue
    iteration: int = 0
    max_iterations: int = 5000


sessions: dict[str, dict] = {}


def create_agent(api_key: str, model_name: str) -> Agent[AgentDeps, str]:
    provider = OpenRouterProvider(api_key=api_key)
    model = OpenRouterModel(model_name, provider=provider)

    agent = Agent(
        model,
        deps_type=AgentDeps,
        instructions=SYSTEM_PROMPT,
    )

    @agent.tool
    async def file_write(ctx: RunContext[AgentDeps], file_path: str, content: str) -> str:
        """Write content to a file in the workspace. Creates the file if it doesn't exist, overwrites if it does.

        Args:
            file_path: The path of the file to write, relative to workspace root (e.g., 'src/index.html', 'README.md')
            content: The full content to write to the file
        """
        try:
            result_path = write_file(file_path, content)
            await ctx.deps.event_queue.put(AgentEvent(
                type=AgentEventType.TOOL_CALL,
                content=f"Writing file: {result_path}",
                tool_name="file_write",
                tool_args={"file_path": file_path},
                file_path=result_path,
                iteration=ctx.deps.iteration,
            ))
            await ctx.deps.event_queue.put(AgentEvent(
                type=AgentEventType.TOOL_RESULT,
                content=f"File written successfully: {result_path}",
                tool_name="file_write",
                file_path=result_path,
                iteration=ctx.deps.iteration,
            ))
            return f"Successfully wrote file: {result_path}"
        except Exception as e:
            error_msg = f"Error writing file {file_path}: {str(e)}"
            await ctx.deps.event_queue.put(AgentEvent(
                type=AgentEventType.TOOL_CALL,
                content=error_msg,
                tool_name="file_write",
                tool_args={"file_path": file_path},
                file_path=file_path,
                is_error=True,
                iteration=ctx.deps.iteration,
            ))
            return error_msg

    return agent


async def run_agent_stream(
    message: str,
    api_key: str,
    model_name: str,
    session_id: str,
    max_iterations: int = 5000,
) -> AsyncGenerator[str, None]:
    event_queue: asyncio.Queue = asyncio.Queue()

    if session_id not in sessions:
        sessions[session_id] = {
            "message_history": [],
            "iteration": 0,
            "is_running": False,
        }

    session = sessions[session_id]
    session["is_running"] = True
    message_history: list[ModelMessage] = session["message_history"]

    deps = AgentDeps(
        session_id=session_id,
        event_queue=event_queue,
        iteration=session["iteration"],
        max_iterations=max_iterations,
    )

    agent = create_agent(api_key, model_name)

    session["iteration"] += 1
    deps.iteration = session["iteration"]

    yield format_sse(AgentEvent(
        type=AgentEventType.STATUS,
        content="Agent started",
        iteration=session["iteration"],
    ))

    yield format_sse(AgentEvent(
        type=AgentEventType.ITERATION,
        content=f"Iteration {session['iteration']}",
        iteration=session["iteration"],
    ))

    agent_task_done = False
    result_holder = {"result": None, "error": None}

    async def run_agent_task():
        nonlocal agent_task_done
        try:
            result = await agent.run(
                message,
                deps=deps,
                message_history=message_history if message_history else None,
            )
            result_holder["result"] = result
        except Exception as e:
            result_holder["error"] = str(e)
        finally:
            agent_task_done = True

    task = asyncio.create_task(run_agent_task())

    while not agent_task_done:
        try:
            ev = await asyncio.wait_for(event_queue.get(), timeout=0.3)
            yield format_sse(ev)
        except asyncio.TimeoutError:
            if agent_task_done:
                break
            continue

    while not event_queue.empty():
        ev = await event_queue.get()
        yield format_sse(ev)

    await task

    if result_holder["error"]:
        yield format_sse(AgentEvent(
            type=AgentEventType.ERROR,
            content=result_holder["error"],
            is_error=True,
            iteration=session["iteration"],
        ))
    elif result_holder["result"]:
        result = result_holder["result"]
        output_text = result.output if isinstance(result.output, str) else str(result.output)

        for chunk_start in range(0, len(output_text), 50):
            chunk = output_text[chunk_start:chunk_start + 50]
            yield format_sse(AgentEvent(
                type=AgentEventType.TEXT_DELTA,
                content=chunk,
                iteration=session["iteration"],
            ))
            await asyncio.sleep(0.02)

        yield format_sse(AgentEvent(
            type=AgentEventType.TEXT_COMPLETE,
            content=output_text,
            iteration=session["iteration"],
        ))

        all_msgs = result.all_messages()
        session["message_history"] = all_msgs

    session["is_running"] = False
    yield format_sse(AgentEvent(
        type=AgentEventType.DONE,
        content="Agent completed",
        iteration=session["iteration"],
    ))


def format_sse(event: AgentEvent) -> str:
    data = event.model_dump_json()
    return f"data: {data}\n\n"


def get_session(session_id: str) -> dict:
    return sessions.get(session_id, {})


def reset_session(session_id: str):
    if session_id in sessions:
        del sessions[session_id]