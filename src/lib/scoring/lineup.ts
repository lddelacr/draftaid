import type { LineupSlots, Player, Position } from "@/types";

/**
 * Turning a pile of drafted players into a starting lineup.
 *
 * A roster list sorted by pick order doesn't answer the question you actually
 * ask mid-draft — "what am I still missing?" — so we fill named slots instead
 * and leave the empty ones visible.
 */

export type SlotKind = Position | "FLEX" | "SUPERFLEX" | "BN";

export interface LineupSlot {
  readonly id: string;
  readonly kind: SlotKind;
  readonly label: string;
  readonly player: Player | null;
}

const FLEX_ELIGIBLE: readonly Position[] = ["RB", "WR", "TE"];
const SUPERFLEX_ELIGIBLE: readonly Position[] = ["QB", "RB", "WR", "TE"];

const accepts = (kind: SlotKind, position: Position): boolean => {
  if (kind === "FLEX") return FLEX_ELIGIBLE.includes(position);
  if (kind === "SUPERFLEX") return SUPERFLEX_ELIGIBLE.includes(position);
  if (kind === "BN") return true;
  return kind === position;
};

/** Slot order as it reads on a lineup card. */
function slotOrder(lineup: LineupSlots): SlotKind[] {
  const order: SlotKind[] = [];
  const push = (kind: SlotKind, count: number) => {
    for (let index = 0; index < count; index += 1) order.push(kind);
  };
  push("QB", lineup.QB);
  push("RB", lineup.RB);
  push("WR", lineup.WR);
  push("TE", lineup.TE);
  push("FLEX", lineup.FLEX);
  push("K", lineup.K);
  push("DST", lineup.DST);
  push("SUPERFLEX", lineup.SUPERFLEX);
  return order;
}

/**
 * Fills dedicated slots before flex ones, in draft order. A player who has no
 * open slot falls to the bench rather than displacing anyone, so the card never
 * silently reshuffles picks you already made.
 */
export function fillLineup(
  roster: readonly Player[],
  lineup: LineupSlots,
): { starters: LineupSlot[]; bench: Player[] } {
  const kinds = slotOrder(lineup);
  const starters: LineupSlot[] = kinds.map((kind, index) => ({
    id: `${kind}-${index}`,
    kind,
    label: kind === "SUPERFLEX" ? "SFLX" : kind,
    player: null,
  }));

  const bench: Player[] = [];

  for (const player of roster) {
    const dedicated = starters.findIndex(
      (slot) => slot.player === null && slot.kind === player.position,
    );
    const target =
      dedicated !== -1
        ? dedicated
        : starters.findIndex(
            (slot) =>
              slot.player === null &&
              (slot.kind === "FLEX" || slot.kind === "SUPERFLEX") &&
              accepts(slot.kind, player.position),
          );

    const slot = target === -1 ? undefined : starters[target];
    if (slot) starters[target] = { ...slot, player };
    else bench.push(player);
  }

  return { starters, bench };
}
