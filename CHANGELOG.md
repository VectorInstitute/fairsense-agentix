# Changelog

All notable changes to this project are documented here. The [JOSS paper](https://doi.org/10.21105/joss.11060) describes the peer-reviewed release; cite the [Zenodo version DOI](https://doi.org/10.5281/zenodo.24354331) you used (or another version from the [Zenodo concept record](https://doi.org/10.5281/zenodo.23106857)) for reproducible software and data snapshots.

## [0.3.0] — 2026-11-18

Zenodo: [10.5281/zenodo.24354331](https://doi.org/10.5281/zenodo.24354331) · PyPI: `fairsense-agentix==0.3.0`

### Data and risk index

- Bundle MIT AI Risk Repository **V4** (**1,538** risks, Dec 2025 snapshot); JOSS paper remains on **V3** (1,340).
- Scripts: `transform_mit_data.py` (`--repository-version v3|v4`), `build_faiss_indexes.py --device`, `sync_package_indexes.py`.
- RMF mitigations loaded **by MIT `risk_id`** via `rmf_lookup` (illustrative NIST templates; see [docs/mit-risk-index.md](docs/mit-risk-index.md)).

### API and Python

- `/v1/health`: `software_version`, `mit_risk_repository_version`, snapshot date, `indexed_risk_count`.
- Risk results expose `joined_table`; default **`rmf_per_risk`: 4** (max 20).

### Web UI

- Vite dev **proxy** for `/v1` (single-port SSH to 5173).
- Risk batch mode, CSV upload, exports, corpus badge, RMF disclosures, deduplicated risk cards.
- Clearer single-run streaming and failed bias error display.

### Documentation

- [MIT risk index](docs/mit-risk-index.md), updated user guide, API, architecture, and data READMEs.

[0.3.0]: https://github.com/VectorInstitute/fairsense-agentix/releases/tag/v0.3.0
