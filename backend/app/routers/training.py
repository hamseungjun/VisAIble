import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.training import (
    PredictDigitRequest,
    PredictDigitResponse,
    StartTrainingResponse,
    TrainingControlResponse,
    TrainModelRequest,
    TrainModelResponse,
    TrainingJobStatusResponse,
)
from app.services.training import (
    get_training_job,
    pause_training_job,
    predict_mnist_digit,
    resume_training_job,
    start_training_job,
    stop_training_job,
    train_model,
)

router = APIRouter(tags=["training"])


@router.post("/training/run", response_model=TrainModelResponse)
def run_training(payload: TrainModelRequest) -> TrainModelResponse:
    try:
        result = train_model(payload, job_id=None)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return TrainModelResponse(**result)


@router.post("/training/start", response_model=StartTrainingResponse)
def start_training(payload: TrainModelRequest) -> StartTrainingResponse:
    try:
        result = start_training_job(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return StartTrainingResponse(**result)


@router.get("/training/status/{job_id}", response_model=TrainingJobStatusResponse)
def get_training_status(job_id: str) -> TrainingJobStatusResponse:
    job = get_training_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Training job not found")

    return TrainingJobStatusResponse(**job)


@router.post("/training/pause/{job_id}", response_model=TrainingControlResponse)
def pause_training(job_id: str) -> TrainingControlResponse:
    result = pause_training_job(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingControlResponse(**result)


@router.post("/training/resume/{job_id}", response_model=TrainingControlResponse)
def resume_training(job_id: str) -> TrainingControlResponse:
    result = resume_training_job(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingControlResponse(**result)


@router.post("/training/stop/{job_id}", response_model=TrainingControlResponse)
def stop_training(job_id: str) -> TrainingControlResponse:
    result = stop_training_job(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingControlResponse(**result)


@router.get("/training/stream/{job_id}")
async def stream_training_status(job_id: str) -> StreamingResponse:
    if get_training_job(job_id) is None:
        raise HTTPException(status_code=404, detail="Training job not found")

    async def event_generator():
        previous_payload = None

        while True:
            job = get_training_job(job_id)
            if job is None:
                break

            payload = json.dumps(job)
            if payload != previous_payload:
                previous_payload = payload
                yield f"data: {payload}\n\n"

            if job.get("status") in {"completed", "failed", "stopped"}:
                break

            await asyncio.sleep(0.1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/training/predict/{job_id}", response_model=PredictDigitResponse)
def predict_digit(job_id: str, payload: PredictDigitRequest) -> PredictDigitResponse:
    try:
        result = predict_mnist_digit(job_id, payload.pixels)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return PredictDigitResponse(**result)
