"""
build_experts.py — turns an external ranking list into a bundled source.

External lists are flat: an order, and nothing else. They carry no tiers and no
target/pass/avoid, because their authors do not publish those. That is modelled
honestly rather than papered over — a bundled source supplies overall order and
positional order only, and the app shows no tier banding for it.

Input CSV columns: rank,name,tier,position   (tier is ignored)
Usage: python scripts/build_experts.py <slug> "<Display Name>" <csv> [note]
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ALIASES = {
    "marshawn lloyd": "MarShawn Lloyd",
    "mike washington": "Mike Washington Jr.",
    "deebo samuel": "Deebo Samuel Sr.",
    "chris godwin": "Chris Godwin Jr.",
    "kyle pitts sr": "Kyle Pitts Sr.",
    "tyrone tracy jr": "Tyrone Tracy Jr.",
}


def norm(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", ascii_name.lower())


def main() -> None:
    slug, display, csv_path = sys.argv[1], sys.argv[2], Path(sys.argv[3])
    note = sys.argv[4] if len(sys.argv) > 4 else ""

    players = json.loads(Path("src/lib/data/players.json").read_text())
    by_norm = {norm(p["name"]): p for p in players}
    for alias, real in ALIASES.items():
        if norm(real) in by_norm:
            by_norm[norm(alias)] = by_norm[norm(real)]

    entries, unmatched = [], []
    for line in csv_path.read_text().splitlines():
        if not line.strip():
            continue
        parts = [c.strip() for c in line.split(",")]
        if len(parts) < 4:
            continue
        name = parts[1]
        player = by_norm.get(norm(name))
        if player is None:
            unmatched.append(name)
            continue
        entries.append(player["id"])

    Path("src/lib/data/experts").mkdir(parents=True, exist_ok=True)
    out = {"id": slug, "name": display, "note": note, "order": entries}
    Path(f"src/lib/data/experts/{slug}.json").write_text(json.dumps(out, indent=1))

    print(f"  {slug}: {len(entries)} matched")
    if unmatched:
        print(f"  UNMATCHED ({len(unmatched)}): {', '.join(unmatched)}")


if __name__ == "__main__":
    main()
