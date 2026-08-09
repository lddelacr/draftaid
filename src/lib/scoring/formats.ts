import type { LineupSlots, Position, ScoringFormat } from "@/types";

/**
 * The guide ships PPR and half-PPR boards. Standard is deliberately absent as a
 * *ranking* — inventing a standard order would mean reordering the guide, which
 * is the one thing this app must not do. It is exposed as a lineup preset only,
 * paired with the half-PPR board, and labelled as such in the UI.
 */

export const FORMAT_LABELS: Record<ScoringFormat, string> = {
  ppr: "PPR",
  half: "Half PPR",
};

export const DEFAULT_LINEUP: LineupSlots = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  BENCH: 7,
};

export const SUPERFLEX_LINEUP: LineupSlots = { ...DEFAULT_LINEUP, SUPERFLEX: 1 };

export const startersPerTeam = (lineup: LineupSlots): number =>
  lineup.QB + lineup.RB + lineup.WR + lineup.TE + lineup.FLEX + lineup.SUPERFLEX;

export const rosterSize = (lineup: LineupSlots): number =>
  startersPerTeam(lineup) + lineup.BENCH;

const FLEX_ELIGIBLE: readonly Position[] = ["RB", "WR", "TE"];

/**
 * Remaining starting requirement by position, treating FLEX and SUPERFLEX as
 * spillover once the dedicated slots are filled. Used to surface roster need
 * next to the board rather than making the user count their own bench.
 */
export function openStarters(
  lineup: LineupSlots,
  roster: readonly Position[],
): Record<Position | "FLEX" | "SUPERFLEX", number> {
  const filled: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  for (const position of roster) filled[position] += 1;

  const need = {
    QB: Math.max(0, lineup.QB - filled.QB),
    RB: Math.max(0, lineup.RB - filled.RB),
    WR: Math.max(0, lineup.WR - filled.WR),
    TE: Math.max(0, lineup.TE - filled.TE),
    FLEX: lineup.FLEX,
    SUPERFLEX: lineup.SUPERFLEX,
  };

  const spare = FLEX_ELIGIBLE.reduce(
    (total, position) => total + Math.max(0, filled[position] - lineup[position]),
    0,
  );
  need.FLEX = Math.max(0, lineup.FLEX - spare);

  const spareQb = Math.max(0, filled.QB - lineup.QB);
  need.SUPERFLEX = Math.max(0, lineup.SUPERFLEX - spareQb - Math.max(0, spare - lineup.FLEX));

  return need;
}
