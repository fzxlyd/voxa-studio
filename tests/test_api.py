from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import VoiceOption


client = TestClient(app)


async def _fake_voices(locale: str | None = None) -> list[VoiceOption]:
    return [
        VoiceOption(
            short_name="en-US-AriaNeural",
            display_name="Aria",
            locale="en-US",
            gender="Female",
        )
    ]


async def _fake_speech(payload, output_path):
    output_path.write_bytes(b"fake-mp3")
    return payload.voice or "en-US-AriaNeural"


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_speak_success(monkeypatch) -> None:
    from app import main

    monkeypatch.setattr(main, "list_available_voices", _fake_voices)
    monkeypatch.setattr(main, "synthesize_speech", _fake_speech)

    response = client.post(
        "/api/speak",
        json={"text": "Hello world", "voice": "en-US-AriaNeural", "rate": 0, "pitch": 0, "format": "mp3"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["voice"] == "en-US-AriaNeural"
    assert data["audio_url"].startswith("/audio/")


def test_speak_unknown_voice(monkeypatch) -> None:
    from app import main

    monkeypatch.setattr(main, "list_available_voices", _fake_voices)

    response = client.post(
        "/api/speak",
        json={"text": "Hello", "voice": "en-US-GuyNeural", "rate": 0, "pitch": 0, "format": "mp3"},
    )

    assert response.status_code == 400


def test_speak_empty_text(monkeypatch) -> None:
    from app import main

    monkeypatch.setattr(main, "list_available_voices", _fake_voices)

    response = client.post(
        "/api/speak",
        json={"text": "  ", "voice": "en-US-AriaNeural", "rate": 0, "pitch": 0, "format": "mp3"},
    )

    assert response.status_code == 422
