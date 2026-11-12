# Raw data for FAISS indexes

MIT AI Risk Repository exports live here **locally** (repo `*.csv` is gitignored).

## Obtain the database CSV

1. Open the [MIT AI Risk Repository](https://airisk.mit.edu/) spreadsheet (CC BY 4.0).
2. Select the **`AI Risk Database v4`** tab (or v3 for the JOSS paper snapshot).
3. **File → Download → Comma-separated values (.csv)**.
4. Save under `data/raw/` using the expected filename (or pass `--input` to the transform script).

| Snapshot | Expected filename |
|----------|-------------------|
| V3 (26 Mar 2025) | `Copy of The AI Risk Repository V3_26_03_2025 (please create a copy) - AI Risk Database v3.csv` |
| V4 (3 Dec 2025) | `Copy of The AI Risk Repository V4_03_12_2025 - AI Risk Database v4.csv` |

Only rows with **`Category level`** = `Risk Category` or `Risk Sub-Category` are indexed.

## Build pipeline

```bash
# Default: V4 export in data/raw/
uv run python scripts/transform_mit_data.py

# Explicit V3 (reproduce JOSS 1,340-risk index)
uv run python scripts/transform_mit_data.py --repository-version v3

# Custom path
uv run python scripts/transform_mit_data.py --input /path/to/export.csv
```

Outputs: `data/raw/ai_risks.csv`, `data/raw/ai_rmf.csv` (see [DATA_FORMAT.md](DATA_FORMAT.md)).

```bash
uv run python scripts/build_faiss_indexes.py
uv run python scripts/sync_package_indexes.py
```

Packaged indexes ship under `fairsense_agentix/data/indexes/`.
