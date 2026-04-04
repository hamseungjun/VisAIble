from pydantic import BaseModel, Field, field_validator


ALLOWED_BATCH_SIZES = {1, 8, 16, 32, 64, 128}


class NodeFieldPayload(BaseModel):
    label: str
    value: str


class CanvasNodePayload(BaseModel):
    id: str
    type: str
    title: str
    fields: list[NodeFieldPayload]
    activation: str


class OptimizerParamsPayload(BaseModel):
    momentum: str = "0.90"
    rho: str = "0.99"


class TrainModelRequest(BaseModel):
    datasetId: str = Field(..., min_length=1)
    learningRate: float = Field(..., gt=0)
    epochs: int = Field(..., ge=1, le=500)
    batchSize: int = Field(default=128)
    optimizer: str = Field(..., min_length=1)
    optimizerParams: OptimizerParamsPayload
    augmentations: list[str] = Field(default_factory=list)
    augmentationParams: dict[str, float] = Field(default_factory=dict)
    nodes: list[CanvasNodePayload]

    @field_validator("batchSize")
    @classmethod
    def validate_batch_size(cls, value: int) -> int:
        if value not in ALLOWED_BATCH_SIZES:
            raise ValueError("Batch size must be one of 1, 8, 16, 32, 64, 128")
        return value


class EpochMetrics(BaseModel):
    epoch: int
    trainLoss: float
    trainAccuracy: float
    validationLoss: float
    validationAccuracy: float


class TrainModelResponse(BaseModel):
    datasetId: str
    epochs: int
    learningRate: float
    batchSize: int
    optimizer: str
    trainSize: int
    validationSize: int
    numClasses: int
    device: str
    architecture: list[str]
    metrics: list[EpochMetrics]
    bestValidationAccuracy: float


class StartTrainingResponse(BaseModel):
    jobId: str
    status: str


class PredictDigitRequest(BaseModel):
    pixels: list[float] = Field(..., min_length=28 * 28, max_length=28 * 28)


class PredictDigitResponse(BaseModel):
    predictedLabel: int
    confidence: float
    probabilities: list[float]


class PredictSampleRequest(BaseModel):
    pixels: list[float] = Field(..., min_length=1)


class TrainingControlResponse(BaseModel):
    jobId: str
    status: str


class TrainingChallengeSample(BaseModel):
    targetIndex: int
    predictedIndex: int
    confidence: float
    pixels: list[float]


class TrainingJobStatusResponse(BaseModel):
    jobId: str
    status: str
    datasetId: str | None = None
    epochs: int | None = None
    learningRate: float | None = None
    batchSize: int | None = None
    optimizer: str | None = None
    trainSize: int | None = None
    validationSize: int | None = None
    numClasses: int | None = None
    device: str | None = None
    architecture: list[str] = []
    metrics: list[EpochMetrics] = Field(default_factory=list)
    bestValidationAccuracy: float | None = None
    decisionBoundaryAnchors: list[dict[str, float | int]] = Field(default_factory=list)
    decisionBoundaryPredictions: list[int] = Field(default_factory=list)
    convVisualizations: dict[str, dict] = Field(default_factory=dict)
    convVizInput: list[list[int]] | list[list[list[int]]] | None = None
    currentEpoch: int | None = None
    currentBatch: int | None = None
    totalBatches: int | None = None
    stage: str | None = None
    liveTrainLoss: float | None = None
    liveTrainAccuracy: float | None = None
    liveValidationLoss: float | None = None
    liveValidationAccuracy: float | None = None
    challengeSamples: list[TrainingChallengeSample] = Field(default_factory=list)
    error: str | None = None


class DecisionBoundaryAnchor(BaseModel):
    x: float
    y: float
    label: int


class DecisionBoundaryAnchorsResponse(BaseModel):
    datasetId: str
    anchors: list[DecisionBoundaryAnchor] = Field(default_factory=list)


class GradCamRequest(BaseModel):
    classIndex: int


class GradCamResponse(BaseModel):
    gradCamImage: str
    originalImage: str
    predictedLabel: int
    confidence: float
    probabilities: list[float]
