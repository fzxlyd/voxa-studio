from __future__ import annotations

import json
from pathlib import Path

from app.schemas import HistoryItem

MAX_HISTORY_ITEMS = 50


class HistoryStore:
    def __init__(self, history_file: Path, output_dir: Path) -> None:
        self.history_file = history_file
        self.output_dir = output_dir
        self.history_file.parent.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def list(self, limit: int = 20) -> list[HistoryItem]:
        items = self._read_all()
        return items[: max(1, limit)]

    def append(self, item: HistoryItem) -> None:
        items = self._read_all()
        items = [item, *items]
        self._write_all(items[:MAX_HISTORY_ITEMS])

    def delete(self, item_id: str) -> bool:
        items = self._read_all()
        kept: list[HistoryItem] = []
        removed: HistoryItem | None = None

        for item in items:
            if item.id == item_id and removed is None:
                removed = item
                continue
            kept.append(item)

        if removed is None:
            return False

        self._write_all(kept)

        audio_name = removed.audio_url.rsplit("/", 1)[-1]
        audio_path = self.output_dir / audio_name
        if audio_path.exists() and audio_path.is_file():
            audio_path.unlink(missing_ok=True)

        return True

    def _read_all(self) -> list[HistoryItem]:
        if not self.history_file.exists():
            return []

        try:
            raw = json.loads(self.history_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

        if not isinstance(raw, list):
            return []

        items: list[HistoryItem] = []
        for record in raw:
            try:
                items.append(HistoryItem.model_validate(record))
            except Exception:
                continue

        return items

    def _write_all(self, items: list[HistoryItem]) -> None:
        payload = [item.model_dump(mode="json") for item in items]
        self.history_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
