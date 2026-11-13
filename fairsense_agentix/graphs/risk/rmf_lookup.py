"""Load RMF actions keyed by MIT risk id (package ``rmf_meta.json``)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from fairsense_agentix.configs import settings


def _rmf_meta_path() -> Path:
    return settings.faiss_rmf_index_path.parent / "rmf_meta.json"


@lru_cache(maxsize=1)
def _rmf_rows_by_risk_id() -> dict[str, list[dict]]:
    path = _rmf_meta_path()
    if not path.is_file():
        return {}
    rows = json.loads(path.read_text(encoding="utf-8"))
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        risk_id = str(row.get("risk_id") or "")
        if not risk_id:
            continue
        grouped.setdefault(risk_id, []).append(row)
    return grouped


def recommendations_for_risk(risk_id: str, limit: int) -> list[dict]:
    """Return up to ``limit`` distinct RMF actions linked to this risk in the corpus."""
    if limit <= 0:
        return []
    candidates = _rmf_rows_by_risk_id().get(risk_id, [])
    results: list[dict] = []
    seen_actions: set[tuple[str, str]] = set()
    for row in candidates:
        function = str(row.get("function") or "")
        action = str(row.get("action") or "")
        key = (function, action)
        if key in seen_actions or not action:
            continue
        seen_actions.add(key)
        results.append(
            {
                "id": row.get("id"),
                "risk_id": risk_id,
                "function": function,
                "category": row.get("category", ""),
                "recommendation": action,
                "text": action,
                "priority": row.get("priority", ""),
                "score": 1.0,
                "rank": len(results),
            },
        )
        if len(results) >= limit:
            break
    return results
