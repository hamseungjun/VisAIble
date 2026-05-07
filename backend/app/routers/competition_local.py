from fastapi import APIRouter, HTTPException

from app.schemas.competition import CompetitionPrepareSubmissionRequest, CompetitionPreparedSubmission
from app.services.competition_local import prepare_competition_submission


router = APIRouter(tags=["competition-local"])


@router.post(
    "/competition/submissions/prepare",
    response_model=CompetitionPreparedSubmission,
)
def prepare_submission(payload: CompetitionPrepareSubmissionRequest) -> CompetitionPreparedSubmission:
    try:
        return prepare_competition_submission(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
