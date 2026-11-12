"""Tests for per-risk RMF lookup (avoids duplicate template GOVERN lines)."""

from fairsense_agentix.graphs.risk.rmf_lookup import recommendations_for_risk


def test_recommendations_for_risk_returns_distinct_functions() -> None:
    recs = recommendations_for_risk("RISK0001", 4)
    assert len(recs) == 4
    functions = {r["function"] for r in recs}
    assert functions == {"GOVERN", "MAP", "MEASURE", "MANAGE"}
    actions = [r["recommendation"] for r in recs]
    assert len(actions) == len(set(actions))
