from fastapi import APIRouter, HTTPException

from app.schemas.mina import MinaChatRequest, MinaChatResponse
from app.services.mina import chat_with_mina


router = APIRouter(tags=["mina"])


@router.post("/mina/chat", response_model=MinaChatResponse)
def chat_mina(payload: MinaChatRequest) -> MinaChatResponse:
    try:
        result = chat_with_mina(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Mina chat failed: {error}") from error

    return MinaChatResponse(**result)

