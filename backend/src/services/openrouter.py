"""
OpenRouter LLM Client.

Handles communication with the OpenRouter API for:
- Fetching available models
- Streaming chat completions with native tool/function calling
"""

import httpx
import json
from typing import AsyncGenerator

OPENROUTER_API_URL = "https://openrouter.ai/api/v1"


async def fetch_models(api_key: str) -> dict:
    """Fetch all available models from OpenRouter."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{OPENROUTER_API_URL}/models",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "HTTP-Referer": "https://vibe-coder.app",
                    "X-Title": "Vibe Coder",
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])

                formatted = []
                for m in models:
                    formatted.append(
                        {
                            "id": m.get("id"),
                            "name": m.get("name", m.get("id")),
                            "context_length": m.get("context_length", 0),
                            "pricing": m.get("pricing", {}),
                            "description": m.get("description", ""),
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
    Streaming chat completion with native function/tool calling.

    The `tools` parameter contains JSON-schema tool definitions that are
    sent directly to the model API. The LLM decides tool usage via the API
    protocol — no prompt-based simulation.

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

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://vibe-coder.app",
        "X-Title": "Vibe Coder",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{OPENROUTER_API_URL}/chat/completions",
            json=payload,
            headers=headers,
            timeout=120.0,
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield {"type": "error", "error": f"API Error {response.status_code}: {error_text.decode()}"}
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