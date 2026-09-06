"""Emit src/lib/data/experts.ts from the per-analyst JSON files."""
import json
from pathlib import Path

SLUGS = ["boris-chen", "justin-boone"]
blocks = []
for slug in SLUGS:
    data = json.loads(Path(f"src/lib/data/experts/{slug}.json").read_text())
    order = ",\n".join(f'      "{i}"' for i in data["order"])
    blocks.append('''  {
    id: "%s",
    name: "%s",
    note: "%s",
    order: [
%s,
    ],
  },''' % (data["id"], data["name"], data["note"], order))
    print(f"  {slug}: {len(data['order'])}")

Path("src/lib/data/experts.ts").write_text('''import { type ExpertList, playerId } from "@/types";

/**
 * GENERATED — do not edit by hand.
 *   python scripts/build_experts.py <slug> "<Name>" <csv> "<note>"
 *   python scripts/emit_experts.py
 *
 * Published lists from outside analysts, stored as an order of canonical player
 * ids. They carry no target/pass/avoid because their authors do not publish
 * those, and inventing marks would misrepresent the source.
 *
 * These lists run deeper than the guide does, so any player they rank who is
 * not in the dataset is dropped at build time rather than half-created.
 */
const RAW: { id: string; name: string; note: string; order: string[] }[] = [
''' + "\n".join(blocks) + '''
];

export const EXPERT_LISTS: readonly ExpertList[] = RAW.map((list) => ({
  ...list,
  order: list.order.map(playerId),
}));

export const expertById = (id: string): ExpertList | undefined =>
  EXPERT_LISTS.find((list) => list.id === id);
''')
