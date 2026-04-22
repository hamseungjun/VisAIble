from typing import Literal

from pydantic import BaseModel, Field


class MinaNodeField(BaseModel):
    label: str = Field(..., min_length=1, max_length=120)
    value: str = Field(..., min_length=0, max_length=240)


class MinaNodeSummary(BaseModel):
    index: int = Field(..., ge=1, le=64)
    type: str = Field(..., min_length=1, max_length=40)
    title: str = Field(..., min_length=1, max_length=120)
    activation: str = Field(..., min_length=1, max_length=40)
    fields: list[MinaNodeField] = Field(default_factory=list)


class MinaChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1200)
    provider: Literal["gemini", "gemma"] = "gemini"
    requestKind: str = Field(default="general", min_length=1, max_length=32)
    datasetId: str = Field(..., min_length=1, max_length=64)
    datasetLabel: str = Field(..., min_length=1, max_length=200)
    blocksSummary: str = Field(..., min_length=1)
    architectureSummary: str = Field(..., min_length=1)
    metricsSummary: str | None = None
    nodeDetails: list[MinaNodeSummary] = Field(default_factory=list)


class MinaHighlightSuggestion(BaseModel):
    action: str | None = Field(default=None, max_length=32)
    blockIndex: int | None = Field(default=None, ge=1, le=64)
    blockType: str | None = Field(default=None, max_length=40)
    fieldLabel: str | None = Field(default=None, max_length=120)
    suggestedValue: str | None = Field(default=None, max_length=120)
    reason: str | None = Field(default=None, max_length=400)


class MinaChatResponse(BaseModel):
    answer: str
    highlight: MinaHighlightSuggestion | None = None
