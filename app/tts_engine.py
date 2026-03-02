from __future__ import annotations

from pathlib import Path
from time import monotonic

import edge_tts

from app.schemas import SpeakRequest, VoiceOption

DEFAULT_VOICE = "en-US-AriaNeural"
VOICE_CACHE_TTL_SECONDS = 600
_MAX_VOICE_LIMIT = 500

_voice_cache: tuple[float, list[dict]] | None = None


def _to_rate(rate: int) -> str:
    return f"{rate:+d}%"


def _to_pitch(pitch: int) -> str:
    return f"{pitch:+d}Hz"


def parse_locale_from_voice(voice: str) -> str:
    parts = voice.split("-")
    if len(parts) >= 2:
        return f"{parts[0]}-{parts[1]}"
    return "unknown"


async def _get_raw_voices() -> list[dict]:
    global _voice_cache

    now = monotonic()
    if _voice_cache and (now - _voice_cache[0]) < VOICE_CACHE_TTL_SECONDS:
        return _voice_cache[1]

    voices = await edge_tts.list_voices()
    _voice_cache = (now, voices)
    return voices


async def list_available_voices(
    locale: str | None = None,
    search: str | None = None,
    gender: str | None = None,
    limit: int = 200,
) -> list[VoiceOption]:
    voices = await _get_raw_voices()

    normalized_locale = locale.lower().strip() if locale else None
    normalized_search = search.lower().strip() if search else None
    normalized_gender = gender.lower().strip() if gender else None
    max_items = min(max(1, limit), _MAX_VOICE_LIMIT)

    options: list[VoiceOption] = []

    for voice in voices:
        voice_locale = str(voice.get("Locale", ""))
        short_name = str(voice.get("ShortName", ""))
        display_name = str(voice.get("FriendlyName", short_name))
        voice_gender = voice.get("Gender")

        if normalized_locale and not voice_locale.lower().startswith(normalized_locale):
            continue

        if normalized_gender and str(voice_gender or "").lower() != normalized_gender:
            continue

        if normalized_search:
            search_haystack = f"{short_name} {display_name} {voice_locale}".lower()
            if normalized_search not in search_haystack:
                continue

        options.append(
            VoiceOption(
                short_name=short_name,
                display_name=display_name,
                locale=voice_locale,
                gender=voice_gender,
            )
        )

    options.sort(key=lambda v: (v.locale, v.short_name))
    return options[:max_items]


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
