from __future__ import annotations

from pathlib import Path

import edge_tts

from app.schemas import SpeakRequest, VoiceOption

DEFAULT_VOICE = "en-US-AriaNeural"


def _to_rate(rate: int) -> str:
    return f"{rate:+d}%"


def _to_pitch(pitch: int) -> str:
    return f"{pitch:+d}Hz"


async def list_available_voices(locale: str | None = None) -> list[VoiceOption]:
    voices = await edge_tts.list_voices()

    normalized_locale = locale.lower() if locale else None
    options: list[VoiceOption] = []

    for voice in voices:
        voice_locale = str(voice.get("Locale", ""))
        short_name = str(voice.get("ShortName", ""))

        if normalized_locale and not voice_locale.lower().startswith(normalized_locale):
            continue

        options.append(
            VoiceOption(
                short_name=short_name,
                display_name=str(voice.get("FriendlyName", short_name)),
                locale=voice_locale,
                gender=voice.get("Gender"),
            )
        )

    options.sort(key=lambda v: (v.locale, v.short_name))
    return options


async def synthesize_speech(payload: SpeakRequest, output_path: Path) -> str:
    voice = payload.voice or DEFAULT_VOICE
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tts = edge_tts.Communicate(
        text=payload.text,
        voice=voice,
        rate=_to_rate(payload.rate),
        pitch=_to_pitch(payload.pitch),
    )
    await tts.save(str(output_path))

    return voice
