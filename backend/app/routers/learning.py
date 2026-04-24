import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.learning import (
    LearningChapterContent,
    LearningChapterSummary,
    LearningChatRequest,
    LearningChatResponse,
)
from app.services.learning import (
    chat_with_learning_gemini,
    get_learning_chapter_content,
    list_learning_chapters,
)


router = APIRouter(tags=["learning"])


@router.get("/learning/chapters", response_model=list[LearningChapterSummary])
def get_learning_chapters() -> list[LearningChapterSummary]:
    return [LearningChapterSummary(**item) for item in list_learning_chapters()]


@router.get("/learning/chapters/{chapter_id}", response_model=LearningChapterContent)
def get_learning_chapter(chapter_id: str) -> LearningChapterContent:
    try:
        payload = get_learning_chapter_content(chapter_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return LearningChapterContent(**payload)


@router.get("/learning/chapters/{chapter_id}/pdf")
def get_learning_chapter_pdf(chapter_id: str) -> StreamingResponse:
    try:
        payload = get_learning_chapter_content(chapter_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    source_url = str(payload["sourceUrl"])
    try:
        response = requests.get(source_url, stream=True, timeout=45)
        response.raise_for_status()
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"PDF source fetch failed: {error}") from error

    def iter_pdf_chunks():
        try:
            yield from response.iter_content(chunk_size=1024 * 128)
        finally:
            response.close()

    return StreamingResponse(
        iter_pdf_chunks(),
        media_type=response.headers.get("content-type", "application/pdf"),
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.post("/learning/chat", response_model=LearningChatResponse)
def chat_learning(payload: LearningChatRequest) -> LearningChatResponse:
    try:
        result = chat_with_learning_gemini(
            question=payload.question,
            chapter_id=payload.chapterId,
            chapter_title=payload.chapterTitle,
            source_label=payload.sourceLabel,
            source_url=payload.sourceUrl,
            lecture_context=payload.lectureContext,
            selected_excerpt=payload.selectedExcerpt,
            selected_image_base64=payload.selectedImageBase64,
            selected_image_mime_type=payload.selectedImageMimeType,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Learning chat failed: {error}") from error

    return LearningChatResponse(**result)
