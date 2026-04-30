import json
import os
import re
import urllib.request
from typing import Any, Iterator


STRUCTURED_SYSTEM_PROMPT = (
    "你是一个严格基于文件证据回答的学习助手。"
    "只允许根据给定证据回答，不能编造。"
    "请返回 JSON：summary, outline, answer, followUps, quiz, weaknessCandidates。"
)

STREAMING_SYSTEM_PROMPT = (
    "你是一个严格基于文件证据回答的学习助手。"
    "只允许根据给定证据回答，不能编造。"
    "请只输出最终回答正文，不要 JSON，不要前言，不要解释你的步骤。"
)


def generate_grounded_answer(prompt: str) -> dict[str, Any] | None:
    try:
        raw = request_chat_completion(prompt=prompt, system_prompt=STRUCTURED_SYSTEM_PROMPT)
    except Exception:
        return None

    try:
        content = raw["choices"][0]["message"]["content"]
    except Exception:
        return None

    return extract_json(content)


def stream_grounded_answer(prompt: str) -> Iterator[str] | None:
    try:
        response = request_chat_completion(
            prompt=prompt,
            system_prompt=STREAMING_SYSTEM_PROMPT,
            stream=True,
        )
    except Exception:
        return None

    return iter_chat_completion_stream(response)


def request_chat_completion(
    *,
    prompt: str,
    system_prompt: str,
    stream: bool = False,
) -> Any:
    api_key = os.getenv("LLM_API_KEY")
    model = os.getenv("LLM_MODEL")
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    if not api_key or not model:
        raise ValueError("LLM configuration is incomplete.")

    payload = {
        "model": model,
        "temperature": 0.2,
        "stream": stream,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {"role": "user", "content": prompt},
        ],
    }
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=90 if stream else 45) as response:
        if stream:
            return response
        return json.loads(response.read().decode("utf-8"))


def iter_chat_completion_stream(response: Any) -> Iterator[str]:
    try:
        for raw_line in response:
            line = raw_line.decode("utf-8").strip()
            if not line or not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                return
            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                continue
            delta = (
                payload.get("choices", [{}])[0]
                .get("delta", {})
                .get("content")
            )
            if isinstance(delta, str) and delta:
                yield delta
    finally:
        try:
            response.close()
        except Exception:
            pass


def extract_json(content: str) -> dict[str, Any] | None:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    fenced = re.search(r"```json\s*(\{.*\})\s*```", content, flags=re.DOTALL)
    if fenced:
        try:
            return json.loads(fenced.group(1))
        except json.JSONDecodeError:
            return None
    return None
