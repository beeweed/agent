from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agent.react_agent import ReActAgent
from .agent.tool_executor import configure_tool_executor
from .sandbox import SandboxConfig, SandboxManager
from .sandbox.models import SANDBOX_ROOT
from .services.fireworks import fetch_models as fireworks_fetch_models
from .services.groq import fetch_models as groq_fetch_models
from .services.openrouter import fetch_models as openrouter_fetch_models

logger = logging.getLogger(__name__)

app = FastAPI(title="Vibe Coder API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agents: dict[str, ReActAgent] = {}
sandbox_manager = SandboxManager()
configure_tool_executor(sandbox_manager)


class ChatRequest(BaseModel):
    message: str
    api_key: str
    model: str = "anthropic/claude-3.5-sonnet"
    session_id: Optional[str] = None
    provider: Optional[str] = "openrouter"
    novita_api_key: Optional[str] = None
    novita_template_id: Optional[str] = None


class ModelsRequest(BaseModel):
    api_key: str
    provider: Optional[str] = "openrouter"


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/models")
async def get_models(request: ModelsRequest):
    provider = request.provider or "openrouter"
    if provider == "groq":
        result = await groq_fetch_models(request.api_key)
    elif provider == "fireworks":
        result = await fireworks_fetch_models(request.api_key)
    else:
        result = await openrouter_fetch_models(request.api_key)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/chat")
async def chat(request: ChatRequest):
    session_id = request.session_id or "default"
    provider = request.provider or "openrouter"

    if not request.novita_api_key:
        raise HTTPException(status_code=400, detail="Novita sandbox API key is required before chatting.")

    sandbox_config = SandboxConfig(
        api_key=request.novita_api_key,
        template_id=request.novita_template_id or None,
    )

    if session_id not in agents:
        agents[session_id] = ReActAgent(
            api_key=request.api_key,
            model=request.model,
            max_iterations=500,
            session_id=session_id,
            provider=provider,
            sandbox_manager=sandbox_manager,
            sandbox_config=sandbox_config,
        )
    else:
        agents[session_id].api_key = request.api_key
        agents[session_id].model = request.model
        agents[session_id].session_id = session_id
        agents[session_id].provider = provider
        agents[session_id].sandbox_manager = sandbox_manager
        agents[session_id].update_sandbox_config(sandbox_config)

    agent = agents[session_id]

    async def event_generator():
        try:
            async for event in agent.run(request.message):
                if event.get("type") == "sandbox_creation_log":
                    logger.info("[sandbox][%s] %s", session_id, event.get("message", ""))
                elif event.get("type") == "sandbox_error":
                    logger.error("[sandbox][%s] %s", session_id, event.get("error", ""))
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.01)

            yield f"data: {json.dumps({'type': 'stream_end'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/chat/stop")
async def stop_chat(session_id: str = "default"):
    if session_id in agents:
        agents[session_id].stop()
        return {"success": True, "message": "Agent stopped"}
    return {"success": False, "error": "Session not found"}


@app.post("/api/chat/reset")
async def reset_chat(session_id: str = "default"):
    if session_id in agents:
        await agents[session_id].reset()
    await sandbox_manager.reset_session(session_id)
    return {"success": True, "message": "Agent reset"}


@app.get("/api/memory")
async def get_memory(session_id: str = "default"):
    if session_id not in agents:
        return {
            "session_id": session_id,
            "current_iteration": 0,
            "max_iterations": 500,
            "is_running": False,
            "messages": [],
            "stats": {
                "total_messages": 0,
                "tool_calls": 0,
                "files_created": 0,
                "files_in_context": [],
                "file_types": {},
            },
        }

    return agents[session_id].get_memory()


@app.get("/api/status")
async def get_status(session_id: str = "default"):
    if session_id not in agents:
        return {
            "session_id": session_id,
            "is_running": False,
            "current_iteration": 0,
            "max_iterations": 500,
            "status": "idle",
        }

    agent = agents[session_id]
    return {
        "session_id": agent.session_id,
        "is_running": agent.is_running,
        "current_iteration": agent.current_iteration,
        "max_iterations": agent.max_iterations,
        "status": "running" if agent.is_running else "idle",
    }


@app.get("/api/sandbox/status")
async def get_sandbox_status(session_id: str = "default"):
    return sandbox_manager.get_status(session_id)


@app.get("/api/files/tree")
async def get_file_tree(
    session_id: str = "default",
    root_path: str = SANDBOX_ROOT,
    depth: int = Query(default=25, ge=1, le=100),
):
    state = sandbox_manager.get_state(session_id)
    if state.status != "ready" or state.sandbox is None:
        return {
            "name": root_path.rstrip("/").split("/")[-1] or root_path,
            "type": "folder",
            "path": root_path,
            "children": [],
        }

    try:
        return await sandbox_manager.get_file_tree(session_id, root_path=root_path, depth=depth)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/files/content")
async def get_file_content(file_path: str, session_id: str = "default"):
    state = sandbox_manager.get_state(session_id)
    if state.status != "ready" or state.sandbox is None:
        raise HTTPException(status_code=404, detail="Sandbox is not ready")

    try:
        content = await sandbox_manager.read_file(session_id, file_path)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "success": True,
        "file_path": file_path,
        "raw_content": content,
    }