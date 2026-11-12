#!/usr/bin/env python3
"""Copy built LangChain FAISS indexes into the package data directory.

Reads from ``data/indexes/`` (output of ``build_faiss_indexes.py``) and copies
``risks/``, ``rmf/``, ``risks_meta.json``, and ``rmf_meta.json`` into
``fairsense_agentix/data/indexes/`` for wheel/sdist inclusion.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


def sync_indexes(*, src: Path, dest: Path, dry_run: bool) -> int:
    if not src.is_dir():
        print(f"Source directory not found: {src}", file=sys.stderr)
        return 1

    dest.mkdir(parents=True, exist_ok=True)
    artifacts = [
        src / "risks",
        src / "rmf",
        src / "risks_meta.json",
        src / "rmf_meta.json",
    ]
    missing = [p for p in artifacts if not p.exists()]
    if missing:
        print("Missing build artifacts (run build_faiss_indexes.py first):", file=sys.stderr)
        for path in missing:
            print(f"  - {path}", file=sys.stderr)
        return 1

    for path in artifacts:
        target = dest / path.name
        if dry_run:
            print(f"Would copy {path} -> {target}")
            continue
        if path.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(path, target)
        else:
            shutil.copy2(path, target)
        print(f"Copied {path.name} -> {target}")

    return 0


def main() -> int:
    repo = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--src",
        type=Path,
        default=repo / "data" / "indexes",
        help="Directory with built indexes (default: data/indexes)",
    )
    parser.add_argument(
        "--dest",
        type=Path,
        default=repo / "fairsense_agentix" / "data" / "indexes",
        help="Package index directory",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    return sync_indexes(src=args.src.resolve(), dest=args.dest.resolve(), dry_run=args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
