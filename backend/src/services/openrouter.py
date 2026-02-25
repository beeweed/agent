import httpx
import json
from typing import AsyncGenerator, Optional
import os


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
                    "X-Title": "Vibe Coder"
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                models = data.get("data", [])
                
                formatted_models = []
                for model in models:
                    formatted_models.append({
                        "id": model.get("id"),
                        "name": model.get("name", model.get("id")),
                        "context_length": model.get("context_length", 0),
                        "pricing": model.get("pricing", {}),
                        "description": model.get("description", "")
                    })
                
                formatted_models.sort(key=lambda x: x.get("name", "").lower())
                
                return {
                    "success": True,
                    "models": formatted_models
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to fetch models: {response.status_code}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def chat_completion(
    api_key: str,
    model: str,
    messages: list,
    tools: list = None,
    stream: bool = True
) -> AsyncGenerator:
    """
    Make a chat completion request to OpenRouter with streaming.
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
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{OPENROUTER_API_URL}/chat/completions",
            json=payload,
            headers=headers,
            timeout=120.0
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield {
                    "type": "error",
                    "error": f"API Error {response.status_code}: {error_text.decode()}"
                }
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


async def chat_completion_non_streaming(
    api_key: str,
    model: str,
    messages: list,
    tools: list = None
) -> dict:
    """
    Make a non-streaming chat completion request to OpenRouter.
    """
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://vibe-coder.app",
        "X-Title": "Vibe Coder",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OPENROUTER_API_URL}/chat/completions",
                json=payload,
                headers=headers,
                timeout=120.0
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "data": response.json()
                }
            else:
                return {
                    "success": False,
                    "error": f"API Error {response.status_code}: {response.text}"
                }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }