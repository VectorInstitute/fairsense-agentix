"""Tests for packaged MIT AI Risk index metadata and sync layout."""

from __future__ import annotations

import json
from pathlib import Path

from fairsense_agentix.data.risk_corpus import (
    MIT_AI_RISK_REPOSITORY_VERSION,
    MIT_INDEXED_RISK_COUNT,
)

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DATA_META = _REPO_ROOT / "data" / "indexes" / "risks_meta.json"
_PACKAGE_META = _REPO_ROOT / "fairsense_agentix" / "data" / "indexes" / "risks_meta.json"


def test_indexed_risk_count_matches_packaged_meta() -> None:
    """``MIT_INDEXED_RISK_COUNT`` must match ``fairsense_agentix/data/indexes/risks_meta.json``."""
    records = json.loads(_PACKAGE_META.read_text(encoding="utf-8"))
    assert len(records) == MIT_INDEXED_RISK_COUNT
    assert MIT_AI_RISK_REPOSITORY_VERSION == "v4"
    assert MIT_INDEXED_RISK_COUNT == 1538


def test_data_and_package_risk_meta_are_identical() -> None:
    """``sync_package_indexes.py`` output should match ``data/indexes`` artifacts."""
    assert _DATA_META.read_bytes() == _PACKAGE_META.read_bytes()
