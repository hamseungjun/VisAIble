from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import requests

from app.schemas.mina import MinaChatRequest


_GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
_LOCAL_ENV_PATH = Path(__file__).resolve().parents[2] / ".env.local"
_GEMMA_DIR = Path(__file__).resolve().parents[3] / "gemma4"


def _read_local_env_value(key: str) -> str | None:
    if not _LOCAL_ENV_PATH.exists():
        return None

    try:
        for raw_line in _LOCAL_ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() != key:
                continue
            return value.strip().strip('"').strip("'")
    except OSError:
        return None

    return None


def _truncate_text(value: str, limit: int) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: max(0, limit - 3)] + "..."


def _build_node_details(payload: MinaChatRequest) -> str:
    if not payload.nodeDetails:
        return "[]"

    serialized: list[dict[str, object]] = []
    for node in payload.nodeDetails[:12]:
        serialized.append(
            {
                "blockIndex": node.index,
                "type": node.type,
                "title": node.title,
                "activation": node.activation,
                "fields": {field.label: field.value for field in node.fields[:8]},
            }
        )
    return json.dumps(serialized, ensure_ascii=False)


def _build_common_context(payload: MinaChatRequest) -> str:
    compact_question = _truncate_text(payload.question.strip(), 180)
    compact_architecture = _truncate_text(payload.architectureSummary.strip(), 260)
    compact_blocks = _truncate_text(payload.blocksSummary.strip(), 220)
    compact_metrics = _truncate_text((payload.metricsSummary or "No metrics").strip(), 160)
    compact_node_details = _truncate_text(_build_node_details(payload), 900)

    return (
        f"질문: {compact_question}\n"
        f"데이터셋: {payload.datasetLabel} ({payload.datasetId})\n"
        f"아키텍처 요약: {compact_architecture}\n"
        f"블록 요약: {compact_blocks}\n"
        f"최근 학습 지표: {compact_metrics}\n"
        f"블록 상세: {compact_node_details}"
    )


def _build_system_instruction(payload: MinaChatRequest) -> str:
    if payload.requestKind == "improvement":
        return (
            "너는 Mina야. 한국어로 대답해. "
            "LAB의 builder canvas를 코칭한다고 생각하고 전체 블록을 먼저 본 뒤 가장 영향력이 큰 개선 1가지를 골라줘. "
            "Conv 채널만 반복하지 말고 CNN, Pooling, Dropout, Linear, Activation, Kernel Size, Stride, Padding을 함께 비교해. "
            "필요하면 기존 블록 수정 대신 새 블록 추가를 추천해도 된다. "
            "왜 그 변경이 성능을 올릴 가능성이 큰지 구체적으로 설명해. "
            "오직 JSON만 출력해. 마크다운, 코드펜스, 설명 문장 금지. "
            "형식은 정확히 다음 둘 중 하나다: "
            '{"answer":"...", "highlight":{"action":"edit_parameter","blockIndex":1,"fieldLabel":"Output","suggestedValue":"128","reason":"..."}} '
            "또는 "
            '{"answer":"...", "highlight":{"action":"add_block","blockType":"pooling","reason":"..."}}. '
            "blockIndex는 1부터 시작하는 현재 블록 순서다. fieldLabel은 실제 필드 라벨이나 Activation 중 하나만 쓴다. "
            "blockType은 linear, cnn, pooling, dropout 중 하나만 쓴다. 추천 타깃이 없으면 highlight는 null이다. "
            "answer에는 2~3문장으로 병목, 바꿀 값, 기대 효과를 설명해."
        )

    return (
        "너는 Mina야. 한국어로 대답해. "
        "사용자 질문 의도에 맞춰 설명하거나 해석해 주는 가이드 역할이다. "
        "수정 제안을 먼저 꺼내지 말고, 질문이 묻는 내용에 직접 답해. "
        "질문이 인사, 짧은 반응, 잡담, 가벼운 대화이면 모델 구조를 억지로 설명하지 말고 자연스럽고 짧게 대답해. "
        "질문이 실제로 모델, 블록, 학습 상태, 결과 해석에 관한 경우에만 현재 컨텍스트를 참고해서 설명해. "
        "관련 없는 질문에는 블록 요약이나 학습 상태를 먼저 꺼내지 마라. "
        '오직 JSON만 출력해. 형식은 {"answer":"...", "highlight":null} 로 유지해.'
    )


def _gemini_api_key() -> str:
    api_key = (
        os.getenv("GOOGLE_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or _read_local_env_value("GOOGLE_API_KEY")
        or _read_local_env_value("GEMINI_API_KEY")
    )
    if not api_key:
        raise ValueError(
            "Gemini API key is not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY in the backend environment or backend/.env.local."
        )
    return api_key


def _gemini_model() -> str:
    return (
        os.getenv("GEMINI_MODEL")
        or _read_local_env_value("GEMINI_MODEL")
        or "gemini-3-flash-preview"
    )


def _gemma_model_path() -> Path:
    configured = os.getenv("GEMMA_MODEL_PATH") or _read_local_env_value("GEMMA_MODEL_PATH")
    if configured:
        candidate = Path(configured).expanduser()
        if candidate.exists():
            return candidate

    for candidate in sorted(_GEMMA_DIR.glob("*.litertlm")):
        if candidate.is_file():
            return candidate

    raise ValueError(
        "Gemma model is not configured. Add a .litertlm model to gemma4/ or set GEMMA_MODEL_PATH."
    )


@lru_cache(maxsize=1)
def _get_gemma_engine():
    try:
        import litert_lm
    except ImportError as error:
        raise ValueError(
            "Gemma runtime is not installed. Install litert_lm to use the Gemma provider."
        ) from error

    model_path = _gemma_model_path()
    try:
        return litert_lm.Engine(str(model_path))
    except Exception as error:
        raise ValueError(f"Failed to load Gemma model from {model_path.name}: {error}") from error


def _extract_json_block(raw_text: str) -> dict[str, object]:
    decoder = json.JSONDecoder()
    candidates = [raw_text]

    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidates.append(raw_text[start : end + 1])

    for candidate in candidates:
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            parsed, _ = decoder.raw_decode(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    raise ValueError("Gemini returned an invalid structured response")


def _normalize_highlight(raw_highlight: object) -> dict[str, str | int] | None:
    if not isinstance(raw_highlight, dict):
        return None

    action = raw_highlight.get("action")
    block_index = raw_highlight.get("blockIndex")
    block_type = raw_highlight.get("blockType")
    field_label = raw_highlight.get("fieldLabel")
    suggested_value = raw_highlight.get("suggestedValue")
    reason = raw_highlight.get("reason")

    if action == "add_block":
        if not isinstance(block_type, str) or block_type not in {"linear", "cnn", "pooling", "dropout"}:
            return None
        highlight: dict[str, str | int] = {
            "action": "add_block",
            "blockType": block_type,
        }
        if isinstance(reason, str) and reason.strip():
            highlight["reason"] = reason.strip()
        return highlight

    if not isinstance(block_index, int) or block_index < 1:
        return None
    if not isinstance(field_label, str) or not field_label.strip():
        return None

    highlight = {
        "action": "edit_parameter",
        "blockIndex": block_index,
        "fieldLabel": field_label.strip(),
    }

    if isinstance(suggested_value, str) and suggested_value.strip():
        highlight["suggestedValue"] = suggested_value.strip()
    if isinstance(reason, str) and reason.strip():
        highlight["reason"] = reason.strip()

    return highlight


def _extract_candidate_text(payload: dict[str, object]) -> str:
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("Gemini did not return any candidates")

    first = candidates[0]
    if not isinstance(first, dict):
        raise ValueError("Gemini returned an unexpected candidate payload")

    content = first.get("content")
    if not isinstance(content, dict):
        raise ValueError("Gemini returned an empty content payload")

    parts = content.get("parts")
    if not isinstance(parts, list):
        raise ValueError("Gemini returned no text parts")

    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict):
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())

    if not texts:
        raise ValueError("Gemini returned an empty response")

    return "\n".join(texts)


def _gemini_generation_config(model: str, payload: MinaChatRequest, *, retry: bool = False) -> dict[str, object]:
    config: dict[str, object] = {
        "temperature": 0.2 if payload.requestKind == "improvement" else 0.35,
        "topP": 0.85,
        "maxOutputTokens": 1200 if retry else 900,
        "responseMimeType": "application/json",
    }

    if model.startswith("gemini-3"):
        config["thinkingConfig"] = {
            "thinkingLevel": "minimal" if retry else "low",
        }

    return config


def _is_structured_response_error(error: Exception) -> bool:
    if not isinstance(error, ValueError):
        return False
    message = str(error)
    return "invalid structured response" in message or "did not include answer text" in message


def _build_retry_system_instruction(payload: MinaChatRequest) -> str:
    if payload.requestKind == "improvement":
        return (
            "너는 Mina야. 한국어로 답해. "
            "현재 블록 전체를 보고 가장 중요한 개선 1가지만 추천해. "
            "JSON만 출력해. "
            '{"answer":"2~3문장 한국어 설명","highlight":{"action":"edit_parameter","blockIndex":1,"fieldLabel":"Output","suggestedValue":"128","reason":"짧은 이유"}} '
            '또는 {"answer":"2~3문장 한국어 설명","highlight":{"action":"add_block","blockType":"pooling","reason":"짧은 이유"}} '
            '또는 {"answer":"2~3문장 한국어 설명","highlight":null}.'
        )

    return '너는 Mina야. 한국어로 짧게 답해. JSON만 출력해. 형식은 {"answer":"...", "highlight":null}.'


def _parse_response(raw_text: str) -> dict[str, object]:
    parsed = _extract_json_block(raw_text)
    answer = parsed.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("Gemini response did not include answer text")

    return {
        "answer": answer.strip(),
        "highlight": _normalize_highlight(parsed.get("highlight")),
    }


def _chat_with_gemini(payload: MinaChatRequest) -> dict[str, object]:
    model = _gemini_model()
    api_key = _gemini_api_key()
    request_payload = {
        "system_instruction": {
            "parts": [
                {
                    "text": _build_system_instruction(payload),
                }
            ]
        },
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": _build_common_context(payload),
                    }
                ],
            }
        ],
        "generationConfig": _gemini_generation_config(model, payload),
    }

    try:
        response = requests.post(
            _GEMINI_API_URL.format(model=model),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json=request_payload,
            timeout=45,
        )
    except requests.RequestException as error:
        raise ValueError(f"Gemini request failed: {error}") from error

    if response.status_code >= 400:
        detail = ""
        try:
            error_payload = response.json()
            if isinstance(error_payload, dict):
                detail = str(error_payload.get("error") or error_payload)
        except ValueError:
            detail = response.text.strip()
        raise ValueError(
            f"Gemini API returned {response.status_code}. {detail}".strip()
        )

    try:
        response_payload = response.json()
    except ValueError as error:
        raise ValueError("Gemini returned non-JSON response") from error

    raw_text = _extract_candidate_text(response_payload)

    try:
        return _parse_response(raw_text)
    except Exception as error:
        if not _is_structured_response_error(error):
            raise

    retry_payload = {
        "system_instruction": {
            "parts": [
                {
                    "text": _build_retry_system_instruction(payload),
                }
            ]
        },
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": _build_common_context(payload),
                    }
                ],
            }
        ],
        "generationConfig": _gemini_generation_config(model, payload, retry=True),
    }

    try:
        retry_response = requests.post(
            _GEMINI_API_URL.format(model=model),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json=retry_payload,
            timeout=45,
        )
    except requests.RequestException as error:
        raise ValueError(f"Gemini retry request failed: {error}") from error

    if retry_response.status_code >= 400:
        detail = ""
        try:
            error_payload = retry_response.json()
            if isinstance(error_payload, dict):
                detail = str(error_payload.get("error") or error_payload)
        except ValueError:
            detail = retry_response.text.strip()
        raise ValueError(
            f"Gemini retry API returned {retry_response.status_code}. {detail}".strip()
        )

    try:
        retry_response_payload = retry_response.json()
    except ValueError as error:
        raise ValueError("Gemini retry returned non-JSON response") from error

    return _parse_response(_extract_candidate_text(retry_response_payload))


def _extract_gemma_text(response: object) -> str:
    if isinstance(response, str) and response.strip():
        return response.strip()

    if isinstance(response, dict):
        content = response.get("content")
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        parts.append(text.strip())
            if parts:
                return "\n".join(parts)

        text = response.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()

    raise ValueError("Gemma returned an empty response")


def _chat_with_gemma(payload: MinaChatRequest) -> dict[str, object]:
    engine = _get_gemma_engine()
    prompt = (
        f"System instruction:\n{_build_system_instruction(payload)}\n\n"
        f"User context:\n{_build_common_context(payload)}"
    )

    try:
        with engine.create_conversation() as conversation:
            response = conversation.send_message(prompt)
    except Exception as error:
        raise ValueError(f"Gemma request failed: {error}") from error

    return _parse_response(_extract_gemma_text(response))


def chat_with_mina(payload: MinaChatRequest) -> dict[str, object]:
    if payload.provider == "gemma":
        return _chat_with_gemma(payload)

    return _chat_with_gemini(payload)
