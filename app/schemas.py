from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
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
    rate: int
    pitch: int
    format: Literal["mp3"]
    audio_url: str


class VoiceOption(BaseModel):
    short_name: str
    display_name: str
    locale: str
    gender: str | None = None
