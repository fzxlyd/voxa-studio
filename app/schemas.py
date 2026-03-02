from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str | None = None
    rate: int = Field(default=0, ge=-100, le=100)
    pitch: int = Field(default=0, ge=-50, le=50)
    format: Literal["mp3"] = "mp3"

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("text must not be empty")
        return text


class SpeakResponse(BaseModel):
    id: str
    voice: str
    locale: str
    rate: int
    pitch: int
    format: Literal["mp3"]
    audio_url: str
    created_at: str
    characters: int
    text_preview: str


class BatchSpeakRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=20)
    voice: str | None = None
    rate: int = Field(default=0, ge=-100, le=100)
    pitch: int = Field(default=0, ge=-50, le=50)
    format: Literal["mp3"] = "mp3"

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in value:
            normalized = item.strip()
            if not normalized:
                continue
            if len(normalized) > 2000:
                raise ValueError("each text must be at most 2000 characters")
            cleaned.append(normalized)

        if not cleaned:
            raise ValueError("texts must include at least one non-empty line")
        return cleaned


class BatchSpeakItem(BaseModel):
    index: int
    success: bool
    text_preview: str
    result: SpeakResponse | None = None
    error: str | None = None


class BatchSpeakResponse(BaseModel):
    total: int
    success: int
    failed: int
    duration_ms: int
    items: list[BatchSpeakItem]


class VoiceOption(BaseModel):
    short_name: str
    display_name: str
    locale: str
    gender: str | None = None


class PresetItem(BaseModel):
    id: str
    title: str
    locale: str
    text: str


class HistoryItem(BaseModel):
    id: str
    voice: str
    locale: str
    rate: int
    pitch: int
    format: Literal["mp3"]
    audio_url: str
    created_at: str
    characters: int
    text_preview: str
