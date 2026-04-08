from pydantic import BaseModel, Field


class StockNodeFieldPayload(BaseModel):
    label: str
    value: str


class StockNodePayload(BaseModel):
    id: str
    type: str
    title: str
    fields: list[StockNodeFieldPayload]
    activation: str = "None"


class StockPresetResponse(BaseModel):
    ticker: str
    label: str
    sector: str
    description: str


class StockSearchResponse(BaseModel):
    ticker: str
    label: str
    sector: str
    description: str


class StockTrainingRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=12)
    lookbackWindow: int = Field(default=30, ge=10, le=180)
    forecastDays: int = Field(default=14, ge=3, le=60)
    epochs: int = Field(default=35, ge=5, le=200)
    batchSize: int = Field(default=32, ge=4, le=128)
    hiddenSize: int = Field(default=48, ge=8, le=256)
    learningRate: float = Field(default=0.001, gt=0, le=1)
    nodes: list[StockNodePayload] = Field(default_factory=list)


class StockLossPoint(BaseModel):
    epoch: int
    trainLoss: float
    validationLoss: float
    trainDirectionAccuracy: float
    validationDirectionAccuracy: float


class StockActualPoint(BaseModel):
    date: str
    actual: float


class StockBacktestPoint(BaseModel):
    date: str
    actual: float
    predicted: float


class StockForecastPoint(BaseModel):
    date: str
    predicted: float


class StockBatchMetricPoint(BaseModel):
    step: int
    epoch: int
    batch: int
    trainLoss: float
    directionAccuracy: float


class StockTrainingMetrics(BaseModel):
    trainRmse: float
    validationRmse: float
    lastClose: float
    forecastReturnPct: float


class StockTrainingResponse(BaseModel):
    ticker: str
    companyName: str
    sector: str
    period: str
    lookbackWindow: int
    forecastDays: int
    batchSize: int
    trainingSamples: int
    validationSamples: int
    architecture: list[str]
    losses: list[StockLossPoint]
    batchMetrics: list[StockBatchMetricPoint]
    history: list[StockActualPoint]
    backtest: list[StockBacktestPoint]
    forecast: list[StockForecastPoint]
    metrics: StockTrainingMetrics
