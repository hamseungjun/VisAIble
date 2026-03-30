from pydantic import BaseModel, Field


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
    weightDecay: str = "0.0001"
    rho: str = "0.99"


class TrainModelRequest(BaseModel):
    datasetId: str = Field(..., min_length=1)
    learningRate: float = Field(..., gt=0)
    epochs: int = Field(..., ge=1, le=50)
    batchSize: int = Field(default=128, ge=8, le=512)
    optimizer: str = Field(..., min_length=1)
    optimizerParams: OptimizerParamsPayload
    nodes: list[CanvasNodePayload]


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


class TrainingControlResponse(BaseModel):
    jobId: str
    status: str


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
    metrics: list[EpochMetrics] = []
    bestValidationAccuracy: float | None = None
    currentEpoch: int | None = None
    currentBatch: int | None = None
    totalBatches: int | None = None
    stage: str | None = None
    liveTrainLoss: float | None = None
    liveTrainAccuracy: float | None = None
    liveValidationLoss: float | None = None
    liveValidationAccuracy: float | None = None
    error: str | None = None
