"""
parse_guide.py — extracts the source draft guide PDF into structured JSON.

The guide's rankings live in the PDF text layer, so extraction is exact rather
than OCR'd. Sentiment (Target / I'll Pass / Avoiding) is encoded only as glyph
fill colour, which is why we read `non_stroking_color` per word.

Usage:  python scripts/parse_guide.py <path-to-pdf> [out-dir]

Pages (0-indexed):
  3  PPR big board (150)
  4  Positional rankings, PPR      (QB32 / RB60 / WR60 / TE32)
  5  Half-PPR big board (150)
  6  Positional rankings, half-PPR (QB32 / RB60 / WR60 / TE32)
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pdfplumber

# Glyph fill colours used by the guide's legend.
SENTIMENT_BY_COLOR = {
    (0.153, 0.733, 0.212): "target",  # green  — "Target"
    (1.0, 0.902, 0.0): "pass",        # yellow — "I'll Pass"
    (0.918, 0.22, 0.161): "avoid",    # red    — "Avoiding"
}
# Colour of the horizontal rules the guide uses to separate tiers.
TIER_RULE_COLOR = (1.0, 0.851, 0.4)

POSITIONS = ("QB", "RB", "WR", "TE")
RANK_RE = re.compile(r"\d{1,3}$")
LEGEND = {"target", "i'll pass", "avoiding"}


def sentiment(color) -> str:
    if not color:
        return "neutral"
    key = tuple(round(float(c), 3) for c in color)
    return SENTIMENT_BY_COLOR.get(key, "neutral")


def cluster_rows(words, tol: float = 6.0):
    """Group words into visual rows. Rounding `top` merges adjacent rows on
    dense pages, so we cluster against the first word of each run instead."""
    rows, current = [], []
    for word in sorted(words, key=lambda w: w["top"]):
        if current and word["top"] - current[0]["top"] > tol:
            rows.append(current)
            current = []
        current.append(word)
    if current:
        rows.append(current)
    return rows


def columns(page, count: int, min_top: float):
    """Split a page's words into `count` vertical bands."""
    words = [
        w for w in page.extract_words(extra_attrs=["non_stroking_color"])
        if w["top"] > min_top
    ]
    bands = defaultdict(list)
    for word in words:
        bands[min(count - 1, int(word["x0"] / (page.width / count)))].append(word)
    return bands


def parse_big_board(page) -> list[dict]:
    """Rows read: <overall rank> <position> <name>, laid out in three columns."""
    entries: dict[int, dict] = {}
    for band in columns(page, 3, min_top=60).values():
        for row in cluster_rows(band):
            row = sorted(row, key=lambda w: w["x0"])
            if not RANK_RE.fullmatch(row[0]["text"]) or len(row) < 3:
                continue
            if row[1]["text"] not in POSITIONS:
                continue
            entries[int(row[0]["text"])] = {
                "overallRank": int(row[0]["text"]),
                "position": row[1]["text"],
                "name": " ".join(w["text"] for w in row[2:]),
                "sentiment": sentiment(row[2]["non_stroking_color"]),
            }
    return [entries[r] for r in sorted(entries)]


def parse_positional(page) -> dict[str, list[dict]]:
    """Four columns, one per position: <positional rank> <name>.

    The guide marks tiers with yellow horizontal rules drawn across each
    column. Those rules are the author's own tier breaks, so we read them
    directly rather than inferring anything from rank gaps.
    """
    dividers = [
        line for line in page.lines
        if abs(line["top"] - line["bottom"]) < 0.5
        and line["stroking_color"]
        and tuple(round(float(c), 3) for c in line["stroking_color"]) == TIER_RULE_COLOR
    ]
    # Rules are drawn wider than the text they underline, so match them to a
    # column by midpoint band — the same rule the words are bucketed by.
    breaks_by_band: dict[int, list[float]] = defaultdict(list)
    for line in dividers:
        midpoint = (line["x0"] + line["x1"]) / 2
        breaks_by_band[min(3, int(midpoint / (page.width / 4)))].append(line["top"])

    result: dict[str, list[dict]] = {}
    for index, band in sorted(columns(page, 4, min_top=100).items()):
        breaks = sorted(breaks_by_band.get(index, []))
        ranked: dict[int, dict] = {}

        for row in cluster_rows(band):
            row = sorted(row, key=lambda w: w["x0"])
            if not RANK_RE.fullmatch(row[0]["text"]) or len(row) < 2:
                continue
            name = " ".join(w["text"] for w in row[1:])
            if name.lower() in LEGEND:
                continue
            # A rule underlines the last player of a tier, so it falls between
            # that row's top and the next row's top: the count of rules above a
            # row is how many tier breaks precede it.
            top = row[0]["top"]
            ranked[int(row[0]["text"])] = {
                "positionRank": int(row[0]["text"]),
                "name": name,
                "sentiment": sentiment(row[1]["non_stroking_color"]),
                "tier": 1 + sum(1 for rule in breaks if rule < top),
            }

        result[POSITIONS[index]] = [ranked[r] for r in sorted(ranked)]
    return result


def verify(label: str, board: list[dict], positional: dict[str, list[dict]]) -> None:
    """Fail loudly rather than silently shipping a board with holes in it."""
    ranks = {p["overallRank"] for p in board}
    missing = sorted(set(range(1, 151)) - ranks)
    if missing:
        raise SystemExit(f"{label}: big board missing ranks {missing}")

    expected = {"QB": 32, "RB": 60, "WR": 60, "TE": 32}
    for position, size in expected.items():
        found = positional[position]
        if len(found) != size:
            raise SystemExit(f"{label}: {position} has {len(found)}, expected {size}")
        gaps = sorted(set(range(1, size + 1)) - {p["positionRank"] for p in found})
        if gaps:
            raise SystemExit(f"{label}: {position} missing positional ranks {gaps}")

    on_board = {p["name"] for p in board}
    ranked = {p["name"] for group in positional.values() for p in group}
    for name in on_board - ranked:
        print(f"  warn  {label}: {name!r} on big board but absent from position list")


def main() -> None:
    pdf_path = Path(sys.argv[1] if len(sys.argv) > 1 else "guide.pdf")
    out_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "extract")
    out_dir.mkdir(parents=True, exist_ok=True)

    formats = {"ppr": (3, 4), "half": (5, 6)}
    payload = {}

    with pdfplumber.open(pdf_path) as pdf:
        for label, (board_page, position_page) in formats.items():
            board = parse_big_board(pdf.pages[board_page])
            positional = parse_positional(pdf.pages[position_page])
            verify(label, board, positional)
            payload[label] = {"board": board, "positional": positional}
            print(f"  ok    {label}: 150 ranked, "
                  + ", ".join(f"{k}{len(v)}" for k, v in positional.items()))

    if {p["name"] for p in payload["ppr"]["board"]} != {p["name"] for p in payload["half"]["board"]}:
        print("  warn  PPR and half-PPR boards contain different players")

    (out_dir / "guide.json").write_text(json.dumps(payload, indent=1))
    print(f"  wrote {out_dir / 'guide.json'}")


if __name__ == "__main__":
    main()
