import {
  POSITIONS,
  type DraftState,
  type PickNumber,
  type Player,
  type PlayerId,
  type Position,
  type TeamSlot,
  pickNumber,
  teamSlot,
} from "@/types";
import { picksUntilSlot, slotOnClock, totalPicks } from "./snake";
import { type RankingBook, byBook, rankValue } from "@/lib/rankings/book";

/**
 * Read models over `DraftState`. Everything is derived — no denormalised copies
 * of the player list that can fall out of step with the picks.
 */

export const draftedIds = (state: DraftState): Set<PlayerId> =>
  new Set(state.picks.map((pick) => pick.playerId));

export function available(
  state: DraftState,
  players: readonly Player[],
  book: RankingBook,
): Player[] {
  const gone = draftedIds(state);
  return players.filter((player) => !gone.has(player.id)).sort(byBook(book));
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
  book: RankingBook,
): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const player of available(state, players, book)) counts[player.position] += 1;
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
  book: RankingBook,
): Record<Position, { tier: number; left: number } | null> {
  const open = available(state, players, book);
  const result = {} as Record<Position, { tier: number; left: number } | null>;

  for (const position of POSITIONS) {
    const pool = open.filter((player) => player.position === position);
    const first = pool[0];
    const tier = first ? book.entry(first.id)?.tier : undefined;
    result[position] = tier
      ? { tier, left: pool.filter((p) => book.entry(p.id)?.tier === tier).length }
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
  book: RankingBook,
): number {
  const rank = book.entry(player.id)?.overall;
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
  book: RankingBook,
): number | null {
  const rank = book.entry(player.id)?.overall;
  return rank === undefined ? null : pick - rank;
}

/** Players the active book gives an overall rank, in that order. */
export const rankedBoard = (players: readonly Player[], book: RankingBook): Player[] =>
  players
    .filter((player) => book.entry(player.id)?.overall !== undefined)
    .sort(byBook(book));

/** Every player the active book ranks at all. */
export const inBook = (players: readonly Player[], book: RankingBook): Player[] =>
  players.filter((player) => book.entry(player.id) !== undefined);

/** Sorting key, exported for lists that need it without a full comparator. */
export { rankValue };
