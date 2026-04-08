"""
Fireworks AI LLM Client.

Handles communication with the Fireworks AI API for:
- Fetching available models
- Streaming chat completions with native tool/function calling

Fireworks uses an OpenAI-compatible API at https://api.fireworks.ai/inference/v1
Docs: https://docs.fireworks.ai/getting-started/introduction
"""

import httpx
import json
from typing import AsyncGenerator

FIREWORKS_API_URL = "https://api.fireworks.ai/inference/v1"
FIREWORKS_MODELS_API_URL = "https://api.fireworks.ai/v1"


async def fetch_models(api_key: str) -> dict:
    """Fetch available models from Fireworks AI.

    Uses the Fireworks REST API to list serverless models that are publicly
    available (account ``fireworks``).  The response is paginated so we
    iterate through all pages.
    """
    try:
        all_models: list[dict] = []
        page_token: str | None = None

        async with httpx.AsyncClient() as client:
            while True:
                params: dict = {"pageSize": 200}
                if page_token:
                    params["pageToken"] = page_token

                response = await client.get(
                    f"{FIREWORKS_MODELS_API_URL}/accounts/fireworks/models",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    params=params,
                    timeout=30.0,
                )

                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Failed to fetch models: {response.status_code} – {response.text[:300]}",
                    }

                data = response.json()
                models_page = data.get("models", [])
                all_models.extend(models_page)

                page_token = data.get("nextPageToken")
                if not page_token:
                    break

        formatted = []
        for m in all_models:
            name_field = m.get("name", "")
            display_name = m.get("displayName", name_field)

            if not m.get("supportsServerless", False):
                continue

            state = m.get("state", "")
            if state not in ("DEPLOYED", "READY", ""):
                continue

            model_id = name_field
            if model_id.startswith("accounts/fireworks/models/"):
                model_id = model_id
            elif "/" not in model_id:
                model_id = f"accounts/fireworks/models/{model_id}"

            context_length = m.get("contextLength", 0)
            supports_tools = m.get("supportsTools", False)

            desc_parts = []
            if supports_tools:
                desc_parts.append("🔧 Tools")
            if m.get("supportsImageInput", False):
                desc_parts.append("🖼 Vision")
            param_count = (m.get("baseModelDetails") or {}).get("parameterCount", "")
            if param_count:
                desc_parts.append(f"{param_count} params")
            description = " · ".join(desc_parts) if desc_parts else ""

            formatted.append(
                {
                    "id": model_id,
                    "name": display_name or model_id.split("/")[-1],
                    "context_length": context_length,
                    "description": description,
                    "supports_tools": supports_tools,
                }
            )

        formatted.sort(key=lambda x: x.get("name", "").lower())
        return {"success": True, "models": formatted}

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
    Streaming chat completion with native function/tool calling via Fireworks AI.

    Fireworks' chat completions API is OpenAI-compatible so the request and
    SSE response format is identical to OpenRouter / Groq.

    Yields events:
      {"type": "chunk", "data": <raw SSE chunk dict>}
      {"type": "done"}
      {"type": "error", "error": "..."}
    """
    payload: dict = {
        "model": model,
        "messages": messages,
        "stream": stream,
    }

    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{FIREWORKS_API_URL}/chat/completions",
            json=payload,
            headers=headers,
            timeout=120.0,
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield {
                    "type": "error",
                    "error": f"Fireworks API Error {response.status_code}: {error_text.decode()}",
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