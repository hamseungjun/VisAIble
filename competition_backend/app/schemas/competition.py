from pydantic import BaseModel, Field, field_validator


ALLOWED_BATCH_SIZES = {1, 8, 16, 32, 64, 128}


class CompetitionCreateRequest(BaseModel):
    hostName: str = Field(..., min_length=1, max_length=40)
    title: str = Field(default="Class Competition", min_length=1, max_length=80)
    datasetId: str = Field(default="imagenet", min_length=1, max_length=32)
    roomCode: str | None = Field(default=None, min_length=4, max_length=12)
    password: str | None = Field(default=None, min_length=4, max_length=32)
    startsAt: str | None = None
    endsAt: str | None = None


class CompetitionEnterRequest(BaseModel):
    roomCode: str = Field(..., min_length=4, max_length=12)
    password: str = Field(..., min_length=4, max_length=32)
    participantName: str = Field(..., min_length=1, max_length=40)


class CompetitionScoredSubmissionRequest(BaseModel):
    roomCode: str = Field(..., min_length=4, max_length=12)
    participantId: int = Field(..., ge=1)
    datasetId: str = Field(..., min_length=1, max_length=32)
    jobId: str = Field(..., min_length=1)
    optimizer: str = Field(..., min_length=1)
    batchSize: int = Field(...)
    trainAccuracy: float
    validationAccuracy: float
    publicScore: float
    privateScore: float

    @field_validator("batchSize")
    @classmethod
    def validate_batch_size(cls, value: int) -> int:
        if value not in ALLOWED_BATCH_SIZES:
            raise ValueError("Batch size must be one of 1, 8, 16, 32, 64, 128")
        return value


class CompetitionParticipantResponse(BaseModel):
    id: int
    displayName: str
    role: str
    joinedAt: str


class CompetitionRoomResponse(BaseModel):
    roomCode: str
    title: str
    datasetId: str
    hostName: str
    hostParticipantId: int
    participantId: int
    participantName: str
    participantRole: str
    startsAt: str | None = None
    endsAt: str | None = None
    createdAt: str
    isActive: bool
    participants: list[CompetitionParticipantResponse]
    generatedPassword: str | None = None


class CompetitionLeaderboardEntry(BaseModel):
    participantId: int
    participantName: str
    role: str
    rank: int
    publicScore: float
    privateScore: float | None = None
    trainAccuracy: float
    validationAccuracy: float
    optimizer: str
    batchSize: int
    isBaseline: bool
    submittedAt: str


class CompetitionLeaderboardResponse(BaseModel):
    roomCode: str
    title: str
    hostName: str
    datasetId: str
    startsAt: str | None = None
    endsAt: str | None = None
    isActive: bool
    entries: list[CompetitionLeaderboardEntry]


class CompetitionSubmissionResponse(BaseModel):
    submissionId: int
    roomCode: str
    participantId: int
    participantName: str
    isBaseline: bool
    trainAccuracy: float
    validationAccuracy: float
    publicScore: float
    privateScore: float | None = None
    submittedAt: str
