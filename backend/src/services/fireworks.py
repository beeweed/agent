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
    """Fetch ALL models from Fireworks AI — no filtering, no limits.

    Paginates through every page from the ``accounts/fireworks/models``
    endpoint (public/serverless catalogue) as well as the caller's own
    account models, returning the full combined list.
    """
    try:
        all_models: list[dict] = []
        seen_names: set[str] = set()

        async with httpx.AsyncClient() as client:
            # Fetch from the public "fireworks" account (serverless catalogue)
            # AND attempt to fetch the caller's own account models.
            accounts = ["fireworks"]

            # Try to detect the caller's account id via a small probe request
            try:
                probe = await client.get(
                    f"{FIREWORKS_MODELS_API_URL}/accounts",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    timeout=15.0,
                )
                if probe.status_code == 200:
                    probe_data = probe.json()
                    for acct in probe_data.get("accounts", []):
                        acct_name = acct.get("name", "")
                        acct_id = acct_name.replace("accounts/", "") if acct_name.startswith("accounts/") else acct_name
                        if acct_id and acct_id != "fireworks":
                            accounts.append(acct_id)
            except Exception:
                pass  # Non-critical — proceed with "fireworks" only

            for account_id in accounts:
                page_token: str | None = None
                while True:
                    params: dict = {"pageSize": 200}
                    if page_token:
                        params["pageToken"] = page_token

                    response = await client.get(
                        f"{FIREWORKS_MODELS_API_URL}/accounts/{account_id}/models",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        params=params,
                        timeout=30.0,
                    )

                    if response.status_code != 200:
                        # Skip this account on error and continue with others
                        break

                    data = response.json()
                    models_page = data.get("models", [])

                    for m in models_page:
                        name_field = m.get("name", "")
                        if name_field not in seen_names:
                            seen_names.add(name_field)
                            all_models.append(m)

                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break

        formatted = []
        for m in all_models:
            name_field = m.get("name", "")
            display_name = m.get("displayName", name_field)

            model_id = name_field
            if not model_id.startswith("accounts/"):
                if "/" not in model_id:
                    model_id = f"accounts/fireworks/models/{model_id}"

            context_length = m.get("contextLength", 0)
            supports_tools = m.get("supportsTools", False)
            supports_serverless = m.get("supportsServerless", False)
            state = m.get("state", "")

            desc_parts = []
            if supports_tools:
                desc_parts.append("Tools")
            if m.get("supportsImageInput", False):
                desc_parts.append("Vision")
            if supports_serverless:
                desc_parts.append("Serverless")
            if state and state not in ("DEPLOYED", "READY"):
                desc_parts.append(state.capitalize())
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