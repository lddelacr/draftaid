"""Emit src/lib/data/players.ts from the merged JSON dataset."""
import json
from pathlib import Path

players = json.loads(Path("src/lib/data/players.json").read_text())


def rank(r: dict) -> str:
    parts = []
    if "overall" in r:
        parts.append(f'overall: {r["overall"]}')
    parts += [f'position: {r["position"]}', f'tier: {r["tier"]}']
    parts.append(f'sentiment: "{r.get("sentiment", "neutral")}"')
    if r.get("carried"):
        parts.append("carried: true")
    return "{ " + ", ".join(parts) + " }"


rows = []
for p in players:
    ranks = ", ".join(f"{f}: {rank(p['ranks'][f])}" for f in ("ppr", "half") if f in p["ranks"])
    team = f'"{p["team"]}"' if p["team"] else "null"
    rows.append(
        f'  {{ id: "{p["id"]}", name: "{p["name"]}", position: "{p["position"]}", '
        f'team: {team}, teamSource: "{p["teamSource"]}", '
        f'byeWeek: {p["byeWeek"] or "null"}, ranks: {{ {ranks} }} }},'
    )

Path("src/lib/data/players.ts").write_text('''import { type Player, playerId } from "@/types";

/**
 * GENERATED — do not edit by hand.
 *   python scripts/parse_guide.py <guide.pdf> extract
 *   python scripts/build_dataset.py extract/guide.json src/lib/data
 *   python scripts/emit_players.py
 *
 * Source: draft guide edition dated 30 August.
 *
 * Order, tiers and target/pass/avoid come verbatim from that guide. Marks are
 * stored per scoring format because the guide genuinely differs between the two
 * boards. Clubs are joined on from Justin Boone's published top-300, the most
 * complete 2026 source available here; `teamSource` records where each came
 * from.
 */
const ROSTER = [
''' + "\n".join(rows) + '''
] as const;

export const PLAYERS: readonly Player[] = ROSTER.map((row) => ({
  ...row,
  id: playerId(row.id),
}));
''')
print("rows", len(rows))
