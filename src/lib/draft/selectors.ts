import {
  POSITIONS,
  type DraftState,
  type PickNumber,
  type Player,
  type PlayerId,
  type Position,
  type ScoringFormat,
  type TeamSlot,
  pickNumber,
  teamSlot,
} from "@/types";
import { picksUntilSlot, slotOnClock, totalPicks } from "./snake";

/**
 * Read models over `DraftState`. Everything is derived — no denormalised copies
 * of the player list that can fall out of step with the picks.
 */

export const rankIn = (player: Player, format: ScoringFormat): number =>
  player.ranks[format]?.overall ?? 900 + (player.ranks[format]?.position ?? 99);

export const byRank =
  (format: ScoringFormat) =>
  (a: Player, b: Player): number =>
    rankIn(a, format) - rankIn(b, format);

export const draftedIds = (state: DraftState): Set<PlayerId> =>
  new Set(state.picks.map((pick) => pick.playerId));

export function available(state: DraftState, players: readonly Player[]): Player[] {
  const gone = draftedIds(state);
  return players.filter((player) => !gone.has(player.id))
    .sort(byRank(state.settings.format));
}

export const currentPick = (state: DraftState): PickNumber =>
  pickNumber(state.picks.length + 1);

export const isComplete = (state: DraftState): boolean =>
  state.picks.length >= totalPicks(state.settings);

export const onTheClock = (state: DraftState): TeamSlot =>
  slotOnClock(currentPick(state), state.settings.teamCount);

export const isMyPick = (state: DraftState): boolean =>
  onTheClock(state) === state.settings.mySlot;

/** Every seat's roster, indexed by slot (1-based). */
export function rosters(
  state: DraftState,
  players: readonly Player[],
): Map<TeamSlot, Player[]> {
  const index = new Map(players.map((player) => [player.id, player]));
  const result = new Map<TeamSlot, Player[]>();
  for (let slot = 1; slot <= state.settings.teamCount; slot += 1) {
    result.set(teamSlot(slot), []);
  }
  for (const pick of state.picks) {
    const player = index.get(pick.playerId);
    if (player) result.get(pick.slot)?.push(player);
  }
  return result;
}

export const myRoster = (state: DraftState, players: readonly Player[]): Player[] =>
  rosters(state, players).get(state.settings.mySlot) ?? [];

/** How many players remain at each position. */
export function remainingByPosition(
  state: DraftState,
  players: readonly Player[],
): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const player of available(state, players)) counts[player.position] += 1;
  return counts;
}

/**
 * Players left in the same tier as the best available at each position. A low
 * number here is the actual reach signal: two left in the tier means taking one
 * now costs far less than it looks like on rank alone.
 */
export function tierRunway(
  state: DraftState,
  players: readonly Player[],
): Record<Position, { tier: number; left: number } | null> {
  const format = state.settings.format;
  const open = available(state, players);
  const result = {} as Record<Position, { tier: number; left: number } | null>;

  for (const position of POSITIONS) {
    const pool = open.filter((player) => player.position === position);
    const tier = pool[0]?.ranks[format]?.tier;
    result[position] = tier
      ? { tier, left: pool.filter((p) => p.ranks[format]?.tier === tier).length }
      : null;
  }
  return result;
}

/** Position share of the last `window` picks — catches a run as it happens. */
export function recentRun(
  state: DraftState,
  players: readonly Player[],
  window = 8,
): Record<Position, number> {
  const index = new Map(players.map((player) => [player.id, player]));
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const pick of state.picks.slice(-window)) {
    const player = index.get(pick.playerId);
    if (player) counts[player.position] += 1;
  }
  return counts;
}

/**
 * Players who will come off the board before this seat is up. Counted from the
 * current pick, so it is valid on any pick rather than only on your own.
 */
export const picksBeforeMyNext = (state: DraftState): number | null =>
  picksUntilSlot(currentPick(state), state.settings.mySlot, state.settings);

/**
 * Value flag: a player still on the board well past where the guide ranks them.
 * Positive means they have fallen — the number is how many picks past their
 * rank we are.
 */
export function fallenBy(
  player: Player,
  state: DraftState,
): number {
  const rank = player.ranks[state.settings.format]?.overall;
  return rank ? state.picks.length + 1 - rank : 0;
}

/**
 * Where a player went against where the guide ranks them, in picks.
 * Positive means they lasted past their rank (value); negative means someone
 * reached. Null when the guide has no overall rank for them in this format.
 */
export function pickDelta(
  player: Player,
  pick: PickNumber,
  format: ScoringFormat,
): number | null {
  const rank = player.ranks[format]?.overall;
  return rank === undefined ? null : pick - rank;
}

/** Players ranked inside the guide's 150 for a format, in that order. */
export const rankedBoard = (
  players: readonly Player[],
  format: ScoringFormat,
): Player[] =>
  players
    .filter((player) => player.ranks[format]?.overall !== undefined)
    .sort(byRank(format));

/** Every player the guide ranks at all in this format. */
export const inFormat = (
  players: readonly Player[],
  format: ScoringFormat,
): Player[] => players.filter((player) => player.ranks[format] !== undefined);
