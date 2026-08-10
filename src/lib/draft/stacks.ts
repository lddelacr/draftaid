import type { NflTeam, Player, Position } from "@/types";

/**
 * Correlation between a player and the team you have already drafted from.
 *
 * A quarterback and his pass catchers score the same play twice, so pairing
 * them raises your ceiling. A back on that same offence works against it — his
 * best games are the ones where the passing game does least — so the equity
 * overlaps without compounding. Any two pass catchers overlap the same way:
 * they split one target share, so one eating is the other going hungry.
 *
 * Two backs on one offence are the exception. They split carries the same way,
 * but the split is the point — owning both means the touches land on your
 * roster whichever way the job breaks, and an injury promotes your own player.
 * That is a handcuff, and it reads as a positive.
 *
 * This module only reports the relationship; what to do about it stays your
 * call.
 */

const PASS_CATCHERS: readonly Position[] = ["WR", "TE"];

export type StackKind = "stack" | "handcuff" | "conflict";

export interface StackSignal {
  readonly kind: StackKind;
  readonly partners: readonly Player[];
}

/** Your roster grouped by NFL club, for O(1) lookup while rendering rows. */
export function rosterByTeam(roster: readonly Player[]): Map<NflTeam, Player[]> {
  const byTeam = new Map<NflTeam, Player[]>();
  for (const player of roster) {
    if (!player.team) continue;
    byTeam.set(player.team, [...(byTeam.get(player.team) ?? []), player]);
  }
  return byTeam;
}

const isPassCatcher = (player: Player) => PASS_CATCHERS.includes(player.position);

/**
 * Signals for one player against your roster. Both can be present at once —
 * taking Shakir when you already hold Allen and Cook is a stack and a conflict
 * in the same breath — so callers get each list and decide what to show.
 */
export function stackSignals(
  player: Player,
  byTeam: Map<NflTeam, Player[]>,
): StackSignal[] {
  if (!player.team) return [];

  const mates = (byTeam.get(player.team) ?? []).filter((mate) => mate.id !== player.id);
  if (mates.length === 0) return [];

  const stack: Player[] = [];
  const handcuff: Player[] = [];
  const conflict: Player[] = [];

  for (const mate of mates) {
    if (player.position === "QB") {
      if (isPassCatcher(mate)) stack.push(mate);
      if (mate.position === "RB") conflict.push(mate);
    } else if (isPassCatcher(player)) {
      if (mate.position === "QB") stack.push(mate);
      if (mate.position === "RB") conflict.push(mate);
      // Every pass catcher on an offence competes for the same targets,
      // whether or not they play the same position.
      if (isPassCatcher(mate)) conflict.push(mate);
    } else if (player.position === "RB") {
      if (mate.position === "QB" || isPassCatcher(mate)) conflict.push(mate);
      if (mate.position === "RB") handcuff.push(mate);
    }
  }

  const signals: StackSignal[] = [];
  if (stack.length) signals.push({ kind: "stack", partners: stack });
  if (handcuff.length) signals.push({ kind: "handcuff", partners: handcuff });
  if (conflict.length) signals.push({ kind: "conflict", partners: conflict });
  return signals;
}

/** "Josh Allen" -> "J. Allen", so a chip fits beside a name. */
export function shortName(name: string): string {
  const parts = name.split(" ");
  const last = parts.at(-1) ?? name;
  const first = parts[0];
  return parts.length < 2 || !first ? name : `${first[0]}. ${last}`;
}
