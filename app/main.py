from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.schemas import SpeakRequest, SpeakResponse, VoiceOption
from app.tts_engine import DEFAULT_VOICE, list_available_voices, synthesize_speech

BASE_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = BASE_DIR / "web"
OUTPUT_DIR = BASE_DIR / "outputs"
INDEX_FILE = WEB_DIR / "index.html"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Voicebox Open Lite",
    description="Open-source text-to-speech starter inspired by voicebox.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=OUTPUT_DIR), name="audio")
app.mount("/web", StaticFiles(directory=WEB_DIR), name="web")


@app.get("/")
async def root() -> FileResponse:
    return FileResponse(INDEX_FILE)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/voices", response_model=list[VoiceOption])
async def get_voices(locale: str | None = Query(default=None, min_length=2, max_length=16)) -> list[VoiceOption]:
    voices = await list_available_voices(locale=locale)
    return voices


@app.post("/api/speak", response_model=SpeakResponse)
async def speak(payload: SpeakRequest) -> SpeakResponse:
    selected_voice = payload.voice or DEFAULT_VOICE

    voices = await list_available_voices()
    voice_names = {voice.short_name for voice in voices}
    if selected_voice not in voice_names:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown voice '{selected_voice}'. Use /api/voices to list supported voices.",
        )

    file_id = uuid4().hex
    file_name = f"{file_id}.{payload.format}"
    output_path = OUTPUT_DIR / file_name

    try:
        final_voice = await synthesize_speech(payload, output_path)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {exc}") from exc

    return SpeakResponse(
        id=file_id,
        voice=final_voice,
        rate=payload.rate,
        pitch=payload.pitch,
        format=payload.format,
        audio_url=f"/audio/{file_name}",
    )
