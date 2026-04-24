from __future__ import annotations

import os
from functools import lru_cache

import requests

from app.schemas.learning import LearningChapterContent
from app.services.mina import (
    _GEMINI_API_URL,
    _extract_candidate_text,
    _extract_json_block,
    _gemini_api_key,
    _gemini_model,
)


LEARNING_CHAPTERS: dict[str, dict[str, str]] = {
    "dnn-basics": {
        "title": "DNN Basics",
        "summary": "실제 CS229 메인 노트를 그대로 읽으며 supervised learning과 기본 모델링 관점을 훑어봅니다.",
        "sourceLabel": "CS229 Main Notes (PDF)",
        "sourceUrl": "https://cs229.stanford.edu/main_notes.pdf",
        "chapterLabel": "DNN",
    },
    "backprop-regularization": {
        "title": "Backprop and Regularization",
        "summary": "실제 CS231n 강의 슬라이드로 backpropagation과 multi-layer perceptron 흐름을 읽습니다.",
        "sourceLabel": "CS231n Lecture 4 (PDF)",
        "sourceUrl": "https://cs231n.stanford.edu/slides/2024/lecture_4.pdf",
        "chapterLabel": "Training",
    },
    "optimization": {
        "title": "Optimization and Hyperparameters",
        "summary": "실제 CS231n optimization 슬라이드로 SGD, momentum, learning rate schedule을 직접 읽습니다.",
        "sourceLabel": "CS231n Lecture 3 (PDF)",
        "sourceUrl": "https://cs231n.stanford.edu/slides/2024/lecture_3.pdf",
        "chapterLabel": "Optimization",
    },
    "cnn-architectures": {
        "title": "CNN Architectures",
        "summary": "실제 CS231n CNN 슬라이드로 convolution, pooling, spatial hierarchy를 읽습니다.",
        "sourceLabel": "CS231n Lecture 6 (PDF)",
        "sourceUrl": "https://cs231n.stanford.edu/slides/2024/lecture_6_part_1.pdf",
        "chapterLabel": "CNN",
    },
}


LEARNING_SECTIONS: dict[str, list[dict[str, list[str] | str]]] = {
    "dnn-basics": [
        {
            "heading": "Supervised learning의 기본 루프",
            "paragraphs": [
                "입력 x와 정답 y의 관계를 모델이 함수처럼 근사하도록 만드는 흐름입니다. VisAible Builder에서는 데이터셋 선택, 레이어 구성, loss 계산, optimizer 업데이트가 이 루프를 이룹니다.",
                "처음에는 정확한 수식보다 데이터가 어떤 모양으로 들어오고 어떤 출력으로 나와야 하는지 보는 것이 중요합니다.",
            ],
        },
        {
            "heading": "모델은 표현을 쌓는 구조입니다",
            "paragraphs": [
                "Linear layer나 CNN layer는 입력을 더 유용한 표현으로 바꾸는 단계입니다. 여러 층을 쌓는 이유는 단순 픽셀에서 점점 더 추상적인 패턴을 만들기 위해서입니다.",
                "레이어를 추가할수록 표현력은 커지지만, 데이터와 regularization이 부족하면 과적합도 같이 커질 수 있습니다.",
            ],
        },
        {
            "heading": "Loss는 학습의 방향 신호입니다",
            "paragraphs": [
                "Loss는 현재 예측이 정답과 얼마나 다른지 숫자로 보여줍니다. 학습은 이 숫자를 줄이는 방향으로 파라미터를 조금씩 움직이는 과정입니다.",
                "그래프에서 loss가 내려가는데 validation accuracy가 멈춘다면, 모델이 훈련 데이터에만 익숙해지고 있을 가능성을 같이 봐야 합니다.",
            ],
        },
    ],
    "backprop-regularization": [
        {
            "heading": "Backpropagation은 책임을 나눠 계산합니다",
            "paragraphs": [
                "출력의 오차가 각 레이어의 파라미터에 얼마나 책임이 있는지 chain rule로 뒤에서 앞으로 전달합니다.",
                "Builder에서 레이어를 깊게 쌓을수록 이 신호가 여러 단계를 거쳐 전달되므로 activation, 초기화, learning rate의 영향이 더 커집니다.",
            ],
        },
        {
            "heading": "Regularization은 외우기를 줄입니다",
            "paragraphs": [
                "Dropout, weight decay, data augmentation은 모델이 훈련 샘플을 그대로 외우는 대신 더 일반적인 패턴을 찾도록 압력을 줍니다.",
                "훈련 정확도는 높지만 검증 정확도가 낮을 때 regularization을 먼저 의심해볼 수 있습니다.",
            ],
        },
        {
            "heading": "Gradient 흐름을 관찰합니다",
            "paragraphs": [
                "학습이 멈춘 것처럼 보이면 loss, learning rate, activation 조합을 함께 확인해야 합니다.",
                "너무 큰 업데이트는 튀고, 너무 작은 업데이트는 거의 움직이지 않습니다. 그래서 optimization 챕터와 자연스럽게 이어집니다.",
            ],
        },
    ],
    "optimization": [
        {
            "heading": "Optimizer는 파라미터를 움직이는 규칙입니다",
            "paragraphs": [
                "SGD, Momentum, Adam 계열은 gradient를 어떻게 해석하고 다음 위치로 이동할지 정합니다.",
                "같은 모델이라도 optimizer가 달라지면 loss curve의 흔들림, 수렴 속도, 최종 성능이 달라질 수 있습니다.",
            ],
        },
        {
            "heading": "Learning rate는 가장 민감한 손잡이입니다",
            "paragraphs": [
                "Learning rate가 크면 빠르게 움직이지만 좋은 지점을 지나칠 수 있고, 작으면 안정적이지만 너무 오래 걸립니다.",
                "VisAible에서는 learning rate를 바꾼 뒤 loss curve가 매끄럽게 내려가는지, 발산하거나 멈추는지를 먼저 비교하면 좋습니다.",
            ],
        },
        {
            "heading": "Batch와 epoch는 관찰 단위입니다",
            "paragraphs": [
                "Batch size는 한 번 업데이트할 때 보는 샘플 수이고, epoch는 전체 데이터를 몇 번 반복해서 볼지입니다.",
                "작은 batch는 noisy하지만 빠르게 자주 업데이트하고, 큰 batch는 안정적이지만 일반화 특성이 달라질 수 있습니다.",
            ],
        },
    ],
    "cnn-architectures": [
        {
            "heading": "Convolution은 위치 주변의 패턴을 봅니다",
            "paragraphs": [
                "CNN은 작은 필터를 이미지 전체에 적용해 edge, texture, shape 같은 지역 패턴을 찾습니다.",
                "이미지 데이터에서는 모든 픽셀을 독립적으로 보는 MLP보다 공간 구조를 더 잘 활용할 수 있습니다.",
            ],
        },
        {
            "heading": "Pooling은 중요한 신호를 압축합니다",
            "paragraphs": [
                "Pooling은 feature map의 크기를 줄이면서 강한 반응을 남깁니다. 계산량을 줄이고 작은 위치 변화에도 덜 민감하게 만듭니다.",
                "다만 너무 많이 줄이면 세밀한 정보가 사라지므로 CNN layer와 균형을 맞춰야 합니다.",
            ],
        },
        {
            "heading": "깊이는 계층적 표현을 만듭니다",
            "paragraphs": [
                "초기 층은 단순한 선과 질감을, 뒤쪽 층은 더 큰 부품과 클래스 단서를 보는 경향이 있습니다.",
                "Feature map이나 Grad-CAM을 함께 보면 모델이 이미지의 어느 부분을 근거로 삼는지 더 직관적으로 확인할 수 있습니다.",
            ],
        },
    ],
}


def list_learning_chapters() -> list[dict[str, str]]:
    return [
        {"id": chapter_id, **chapter}
        for chapter_id, chapter in LEARNING_CHAPTERS.items()
    ]


@lru_cache(maxsize=12)
def get_learning_chapter_content(chapter_id: str) -> dict[str, object]:
    chapter = LEARNING_CHAPTERS.get(chapter_id)
    if not chapter:
        raise ValueError("Unknown learning chapter")

    return LearningChapterContent(
        id=chapter_id,
        title=chapter["title"],
        summary=chapter["summary"],
        sourceLabel=chapter["sourceLabel"],
        sourceUrl=chapter["sourceUrl"],
        chapterLabel=chapter["chapterLabel"],
        sections=LEARNING_SECTIONS.get(chapter_id, []),
    ).model_dump()


def _learning_gemini_models(primary_model: str) -> list[str]:
    configured_fallbacks = os.getenv("LEARNING_GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite-preview")
    models: list[str] = []
    for model in [primary_model, *configured_fallbacks.split(",")]:
        model = model.strip()
        if model and model not in models:
            models.append(model)
    return models


def _is_retryable_gemini_status(status_code: int) -> bool:
    return status_code == 429 or 500 <= status_code <= 599


def _gemini_error_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip()

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str):
                return message
        return str(error or payload)

    return str(payload)


def chat_with_learning_gemini(
    *,
    question: str,
    chapter_id: str,
    chapter_title: str,
    source_label: str,
    source_url: str,
    lecture_context: str,
    selected_excerpt: str | None,
    selected_image_base64: str | None,
    selected_image_mime_type: str | None,
) -> dict[str, str]:
    api_key = _gemini_api_key()
    model = _gemini_model()

    excerpt_block = selected_excerpt.strip() if selected_excerpt else ""
    context = lecture_context.strip()[:10000]
    has_image = bool(selected_image_base64 and selected_image_mime_type)
    system_instruction = (
        "너는 VisAible Learning 섹터의 Gemini 학습 코치다. "
        "반드시 한국어로 답하고, 사용자가 드롭한 PDF 캡처 내용이나 텍스트를 최우선 근거로 삼아라. "
        "PDF 캡처 내용이 있으면 먼저 그 안에서 보이는 수식, 도표, 축, 레이블, 문장, 시각적 관계를 구체적으로 읽고, "
        "그 다음 이것이 현재 챕터의 개념과 어떻게 연결되는지 설명해라. "
        "캡처 내용이 작거나 일부만 보이면 보이는 범위와 불확실한 범위를 분리해서 말해라. "
        "피상적인 요약으로 끝내지 말고, 학생이 헷갈릴 만한 포인트와 직관을 함께 짚어라. "
        "답변은 5~8문장으로 하고, 필요하면 짧은 줄바꿈을 써도 된다. "
        "질문이 모호하면 현재 PDF 캡처/챕터 문맥 안에서 가장 자연스러운 해석으로 답해라. "
        '오직 JSON만 출력해. 형식은 {"answer":"..."} 하나만 허용한다.'
    )
    user_prompt = "\n".join(
        [
            f"Chapter ID: {chapter_id}",
            f"Chapter Title: {chapter_title}",
            f"Source: {source_label}",
            f"Source URL: {source_url}",
            f"Has PDF Captured Content: {'Yes' if has_image else 'No'}",
            f"Selected Excerpt: {excerpt_block or 'None'}",
            f"Lecture Context: {context or 'No additional context'}",
            f"Question: {question.strip()}",
        ]
    )
    user_parts: list[dict[str, object]] = [{"text": user_prompt}]
    if selected_image_base64 and selected_image_mime_type:
        user_parts.append(
            {
                "inlineData": {
                    "mimeType": selected_image_mime_type,
                    "data": selected_image_base64,
                }
            }
        )

    response: requests.Response | None = None
    errors: list[str] = []

    for candidate_model in _learning_gemini_models(model):
        generation_config: dict[str, object] = {
            "maxOutputTokens": 1400,
            "responseMimeType": "application/json",
        }
        if candidate_model.startswith("gemini-3"):
            generation_config["thinkingConfig"] = {"thinkingLevel": "low"}

        request_payload = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": user_parts}],
            "generationConfig": generation_config,
        }

        try:
            candidate_response = requests.post(
                _GEMINI_API_URL.format(model=candidate_model),
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
                json=request_payload,
                timeout=45,
            )
        except requests.RequestException as error:
            errors.append(f"{candidate_model}: {error}")
            continue

        if candidate_response.status_code < 400:
            response = candidate_response
            break

        detail = _gemini_error_detail(candidate_response)
        errors.append(f"{candidate_model}: {candidate_response.status_code} {detail}".strip())
        if not _is_retryable_gemini_status(candidate_response.status_code):
            break

    if response is None:
        raise ValueError(f"Gemini learning request failed: {' | '.join(errors)}")

    try:
        payload = response.json()
    except ValueError as error:
        raise ValueError("Gemini learning response was not JSON") from error

    raw_text = _extract_candidate_text(payload)
    try:
        parsed = _extract_json_block(raw_text)
    except ValueError:
        return {"answer": raw_text.strip()}

    answer = parsed.get("answer")
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("Gemini learning response did not include an answer")

    return {"answer": answer.strip()}
