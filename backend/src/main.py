import uuid
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from .agent.core import run_agent_stream, get_session, reset_session, sessions
from .agent.file_system import get_file_tree, read_file, clear_workspace
from .agent.schemas import AgentInput


app = FastAPI(title="Autonomous AI Agent System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    message: str = Field(..., min_length=1)
    model: str = Field(default="anthropic/claude-sonnet-4")
    api_key: str = Field(..., min_length=1)
    session_id: Optional[str] = None
    max_iterations: int = Field(default=5000, ge=1, le=5000)


class FetchModelsRequest(BaseModel):
    api_key: str = Field(..., min_length=1)


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/agent/run")
async def agent_run(req: RunRequest):
    session_id = req.session_id or str(uuid.uuid4())

    async def event_generator():
        async for event in run_agent_stream(
            message=req.message,
            api_key=req.api_key,
            model_name=req.model,
            session_id=session_id,
            max_iterations=req.max_iterations,
        ):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session_id,
        },
    )


@app.get("/api/files")
def get_files():
    tree = get_file_tree()
    return {"files": tree}


@app.get("/api/files/read")
def read_file_endpoint(path: str = Query(...)):
    try:
        content = read_file(path)
        return {"path": path, "content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {path}")


@app.post("/api/files/clear")
def clear_files():
    clear_workspace()
    return {"status": "cleared"}


@app.get("/api/session/{session_id}")
def session_info(session_id: str):
    s = get_session(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "iteration": s.get("iteration", 0),
        "is_running": s.get("is_running", False),
        "history_length": len(s.get("message_history", [])),
    }


@app.post("/api/session/{session_id}/reset")
def session_reset(session_id: str):
    reset_session(session_id)
    return {"status": "reset"}


@app.post("/api/models")
async def fetch_models(req: FetchModelsRequest):
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {req.api_key}"},
            )
            resp.raise_for_status()
            data = resp.json()
            models = []
            for m in data.get("data", []):
                models.append({
                    "id": m.get("id", ""),
                    "name": m.get("name", ""),
                    "context_length": m.get("context_length", 0),
                    "pricing": m.get("pricing", {}),
                })
            models.sort(key=lambda x: x["name"])
            return {"models": models}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch models from OpenRouter")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))