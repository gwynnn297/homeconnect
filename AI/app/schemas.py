from typing import Any

from pydantic import BaseModel, Field


class ParseChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)


class ParseChatResponse(BaseModel):
    categoryId: int | None = None
    durationHours: int | None = None
    workDate: str | None = None
    startTime: str | None = None
    serviceIds: list[int] = Field(default_factory=list)
    addressText: str | None = None
    needsAddressConfirmation: bool = True
    missingFields: list[str] = Field(default_factory=list)
    followUpQuestion: str | None = None
    confidence: float = 0.0
    source: str = "rule_based"
    raw: dict[str, Any] | None = None
