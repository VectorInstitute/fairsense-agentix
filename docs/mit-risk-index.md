# MIT AI Risk index (bundled data)

FairSense ships a FAISS index built from the **AI Risk Database** sheet of the
[MIT AI Risk Repository](https://airisk.mit.edu/) (CC BY 4.0).

| Field | Bundled index (**v0.3.0** and later on this release line) |
| --- | --- |
| Repository version | **V4** |
| Export date | **3 December 2025** |
| Indexed risks | **1,538** (`Risk Category` / `Risk Sub-Category` rows) |
| Embeddings | `all-MiniLM-L6-v2`, 384 dimensions |

Constants: `fairsense_agentix.data.risk_corpus`.

The [JOSS paper](https://doi.org/10.21105/joss.11060) and Zenodo **v0.2.2** archive
describe the earlier **V3** snapshot (**1,340** risks, 26 March 2025). Rebuild from
source with `scripts/transform_mit_data.py --repository-version v3` to reproduce that
corpus.

## RMF (mitigation) rows

Bundled **`ai_rmf.csv`** / `rmf_meta.json` actions are **illustrative NIST AI RMF–style
placeholders** produced by `scripts/transform_mit_data.py` (domain → GOVERN / MAP /
MEASURE / MANAGE templates). They are **linked by `risk_id`** to each indexed MIT risk
for structured display—they are **not** direct quotes from the MIT spreadsheet and
should **not** be cited as MIT repository mitigations.

To ship MIT-sourced measures instead, extend the transform to read mitigation columns
from a future export (when present) and rebuild indexes.

## How RMF rows are attached at runtime

After FAISS returns top-k MIT risks, **`search_rmf_per_risk`** loads mitigations from
`rmf_meta.json` via `fairsense_agentix.graphs.risk.rmf_lookup`—**keyed by MIT
`risk_id`**, not by a second global FAISS query on the RMF index. That avoids
duplicate actions when many risks share similar template embeddings. Request
`options["rmf_per_risk"]` (default **4**, max 20) to cap how many actions appear per
risk; the UI uses the same default for risk analysis.

## Rebuild from a new MIT export

See `data/raw/README.md` in the repository.
