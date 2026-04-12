from fastapi import APIRouter, HTTPException, Query

from app.schemas.competition import (
    CompetitionCreateRequest,
    CompetitionEnterRequest,
    CompetitionLeaderboardResponse,
    CompetitionParticipantSubmissionListResponse,
    CompetitionRoomResponse,
    CompetitionScoredSubmissionRequest,
    CompetitionSubmissionResponse,
)
from app.services.competition import (
    create_competition_room,
    enter_competition_room,
    get_competition_leaderboard,
    get_competition_participant_submissions,
    get_competition_room,
    submit_scored_competition_run,
)


router = APIRouter(tags=["competition"])


@router.post("/competition/rooms/create", response_model=CompetitionRoomResponse)
def create_room(payload: CompetitionCreateRequest) -> CompetitionRoomResponse:
    try:
        return create_competition_room(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/competition/rooms/enter", response_model=CompetitionRoomResponse)
def enter_room(payload: CompetitionEnterRequest) -> CompetitionRoomResponse:
    try:
        return enter_competition_room(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/competition/rooms/{room_code}", response_model=CompetitionRoomResponse)
def get_room(
    room_code: str,
    participant_id: int | None = Query(default=None),
) -> CompetitionRoomResponse:
    try:
        return get_competition_room(room_code, participant_id=participant_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/competition/rooms/{room_code}/leaderboard",
    response_model=CompetitionLeaderboardResponse,
)
def get_leaderboard(
    room_code: str,
    participant_id: int | None = Query(default=None),
) -> CompetitionLeaderboardResponse:
    try:
        return get_competition_leaderboard(room_code, participant_id=participant_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/competition/rooms/{room_code}/submissions",
    response_model=CompetitionParticipantSubmissionListResponse,
)
def get_participant_submissions(
    room_code: str,
    participant_id: int = Query(..., ge=1),
) -> CompetitionParticipantSubmissionListResponse:
    try:
        return get_competition_participant_submissions(room_code, participant_id=participant_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/competition/submissions", response_model=CompetitionSubmissionResponse)
def submit_run(payload: CompetitionScoredSubmissionRequest) -> CompetitionSubmissionResponse:
    try:
        return submit_scored_competition_run(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
