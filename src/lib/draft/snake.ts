import {
  type LeagueSettings,
  type PickNumber,
  type TeamSlot,
  pickNumber,
  teamSlot,
} from "@/types";

/**
 * Snake order. Odd rounds run 1..n, even rounds run n..1.
 *
 * Everything here is derived from the pick number rather than stored, so undo
 * is just dropping the last pick — there is no ordering state to unwind.
 */

export const totalPicks = ({ teamCount, rounds }: LeagueSettings): number =>
  teamCount * rounds;

/** 1-based round containing a 1-based pick. */
export function roundOf(pick: PickNumber, teamCount: number): number {
  return Math.floor((pick - 1) / teamCount) + 1;
}

/** Which seat is on the clock for a 1-based pick. */
export function slotOnClock(pick: PickNumber, teamCount: number): TeamSlot {
  const round = roundOf(pick, teamCount);
  const indexInRound = (pick - 1) % teamCount;
  const forward = round % 2 === 1;
  return teamSlot(forward ? indexInRound + 1 : teamCount - indexInRound);
}

/** Every pick number belonging to a seat, in draft order. */
export function picksForSlot(
  slot: TeamSlot,
  settings: LeagueSettings,
): PickNumber[] {
  const { teamCount, rounds } = settings;
  const picks: PickNumber[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const indexInRound = round % 2 === 1 ? slot - 1 : teamCount - slot;
    picks.push(pickNumber((round - 1) * teamCount + indexInRound + 1));
  }
  return picks;
}

/**
 * How many picks until the given seat is up again, counting from `current`.
 * Returns null once that seat has no picks left.
 */
export function picksUntilSlot(
  current: PickNumber,
  slot: TeamSlot,
  settings: LeagueSettings,
): number | null {
  const next = picksForSlot(slot, settings).find((pick) => pick >= current);
  return next === undefined ? null : next - current;
}

/**
 * The window a seat has to live through before picking again: the number of
 * players that will come off the board between its current pick and its next.
 * This is what makes the difference between "I can wait a round" and "this is
 * my last shot at the tier".
 */
export function gapAfterPick(
  slot: TeamSlot,
  settings: LeagueSettings,
  afterPick: PickNumber,
): number | null {
  const picks = picksForSlot(slot, settings);
  const index = picks.findIndex((pick) => pick === afterPick);
  const next = index === -1 ? undefined : picks[index + 1];
  return next === undefined ? null : next - afterPick - 1;
}
