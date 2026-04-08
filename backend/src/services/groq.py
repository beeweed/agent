"""
Groq LLM Client.

Handles communication with the Groq API for:
- Fetching available models
- Streaming chat completions with native tool/function calling

Groq uses an OpenAI-compatible API at https://api.groq.com/openai/v1
"""

import httpx
import json
from typing import AsyncGenerator

GROQ_API_URL = "https://api.groq.com/openai/v1"


async def fetch_models(api_key: str) -> dict:
    """Fetch all available models from Groq."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GROQ_API_URL}/models",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])

                formatted = []
                for m in models:
                    if not m.get("active", True):
                        continue
                    model_id = m.get("id", "")
                    if "whisper" in model_id or "prompt-guard" in model_id or "safeguard" in model_id or "orpheus" in model_id:
                        continue
                    formatted.append(
                        {
                            "id": model_id,
                            "name": model_id,
                            "context_length": m.get("context_window", 0),
                            "description": f"Groq - {m.get('owned_by', 'unknown')}",
                        }
                    )
                formatted.sort(key=lambda x: x.get("name", "").lower())
                return {"success": True, "models": formatted}
            else:
                return {"success": False, "error": f"Failed to fetch models: {response.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def chat_completion(
    api_key: str,
    model: str,
    messages: list,
    tools: list = None,
    stream: bool = True,
) -> AsyncGenerator:
    """
    Streaming chat completion with native function/tool calling via Groq API.

    The Groq API is OpenAI-compatible, so the request/response format
    matches the OpenRouter implementation.

    Yields events:
      {"type": "chunk", "data": <raw SSE chunk dict>}
      {"type": "done"}
      {"type": "error", "error": "..."}
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
    }

    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
        payload["parallel_tool_calls"] = False

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{GROQ_API_URL}/chat/completions",
            json=payload,
            headers=headers,
            timeout=120.0,
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield {"type": "error", "error": f"Groq API Error {response.status_code}: {error_text.decode()}"}
                return

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        yield {"type": "done"}
                        break
                    try:
                        chunk = json.loads(data)
                        yield {"type": "chunk", "data": chunk}
                    except json.JSONDecodeError:
                        continue