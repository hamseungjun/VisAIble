from pydantic import BaseModel, Field


class LearningChapterSummary(BaseModel):
    id: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    summary: str = Field(..., min_length=1, max_length=400)
    sourceLabel: str = Field(..., min_length=1, max_length=120)
    sourceUrl: str = Field(..., min_length=1, max_length=500)
    chapterLabel: str = Field(..., min_length=1, max_length=80)


class LearningChapterSection(BaseModel):
    heading: str = Field(..., min_length=1, max_length=240)
    paragraphs: list[str] = Field(default_factory=list)


class LearningChapterContent(BaseModel):
    id: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=200)
    summary: str = Field(..., min_length=1, max_length=400)
    sourceLabel: str = Field(..., min_length=1, max_length=120)
    sourceUrl: str = Field(..., min_length=1, max_length=500)
    chapterLabel: str = Field(..., min_length=1, max_length=80)
    sections: list[LearningChapterSection] = Field(default_factory=list)


class LearningChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1200)
    chapterId: str = Field(..., min_length=1, max_length=80)
    chapterTitle: str = Field(..., min_length=1, max_length=200)
    sourceLabel: str = Field(..., min_length=1, max_length=120)
    sourceUrl: str = Field(..., min_length=1, max_length=500)
    lectureContext: str = Field(default="", max_length=12000)
    selectedExcerpt: str | None = Field(default=None, max_length=4000)
    selectedImageBase64: str | None = Field(default=None, max_length=8_000_000)
    selectedImageMimeType: str | None = Field(default=None, max_length=120)


class LearningChatResponse(BaseModel):
    answer: str
