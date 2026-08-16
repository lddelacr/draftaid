import {
  type Player,
  type PlayerId,
  type Position,
  type RankingSet,
  type RankingSource,
  type ScoringFormat,
  type Sentiment,
} from "@/types";

/**
 * A ranking book answers one question: where does this player stand?
 *
 * Before custom rankings existed, every component read `player.ranks[format]`
 * and `player.sentiment` straight off the canonical record. That works for one
 * immutable source and nothing else. The book is the seam: the built-in guide
 * and a user's own set both resolve to the same shape, so switching sets needs
 * no change anywhere downstream.
 *
 * Canonical player data (name, club, bye, position) is never copied into a
 * book — only rank, tier and designation, which are the things a ranking set
 * actually owns.
 */

export interface RankedEntry {
  /** Overall board position. Undefined for players a book leaves unranked. */
  readonly overall?: number;
  /** Rank within the player's own position, derived from overall order. */
  readonly position: number;
  readonly tier: number;
  readonly sentiment: Sentiment;
}

export interface RankingBook {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly format: ScoringFormat;
  /** Undefined when this book does not rank the player at all. */
  entry(id: PlayerId): RankedEntry | undefined;
  /** Every player the book ranks, in its own order. */
  readonly ordered: readonly Player[];
  tierName(tier: number): string | undefined;
}

const DEFAULT_ID = "default";

/** Sorting fallback so unranked players sink below ranked ones. */
export const rankValue = (entry: RankedEntry | undefined): number =>
  entry === undefined ? 9999 : (entry.overall ?? 900 + entry.position);

/**
 * The built-in guide. Reads the canonical records and is never mutated — the
 * default data has no writable representation anywhere in the app.
 */
export function defaultBook(
  players: readonly Player[],
  format: ScoringFormat,
): RankingBook {
  const entries = new Map<PlayerId, RankedEntry>();

  for (const player of players) {
    const rank = player.ranks[format];
    if (!rank) continue;
    entries.set(player.id, {
      overall: rank.overall,
      position: rank.position,
      tier: rank.tier,
      sentiment: player.sentiment,
    });
  }

  const ordered = players
    .filter((player) => entries.has(player.id))
    .sort((a, b) => rankValue(entries.get(a.id)) - rankValue(entries.get(b.id)));

  return {
    id: DEFAULT_ID,
    name: format === "ppr" ? "Default Guide (PPR)" : "Default Guide (Half PPR)",
    isDefault: true,
    format,
    entry: (id) => entries.get(id),
    ordered,
    tierName: () => undefined,
  };
}

/**
 * A user's set. Array order is overall rank; positional rank is counted off
 * that order so the two can never disagree.
 *
 * Entries naming a player who no longer exists in the dataset are skipped
 * rather than rendered as a hole — a guide update that drops a player should
 * not corrupt a saved set.
 */
export function customBook(
  set: RankingSet,
  players: readonly Player[],
): RankingBook {
  const byId = new Map(players.map((player) => [player.id, player]));
  const entries = new Map<PlayerId, RankedEntry>();
  const ordered: Player[] = [];
  const seenAtPosition: Partial<Record<Position, number>> = {};
  const seen = new Set<PlayerId>();

  let overall = 0;
  for (const entry of set.entries) {
    const player = byId.get(entry.playerId);
    // Skip unknown ids and any duplicate that a bad merge introduced.
    if (!player || seen.has(entry.playerId)) continue;
    seen.add(entry.playerId);

    overall += 1;
    const positionRank = (seenAtPosition[player.position] ?? 0) + 1;
    seenAtPosition[player.position] = positionRank;

    entries.set(player.id, {
      overall,
      position: positionRank,
      tier: entry.tier,
      sentiment: entry.sentiment,
    });
    ordered.push(player);
  }

  return {
    id: set.id,
    name: set.name,
    isDefault: false,
    format: set.format,
    entry: (id) => entries.get(id),
    ordered,
    tierName: (tier) => set.tierNames[tier],
  };
}

export function resolveBook(
  source: RankingSource,
  sets: readonly RankingSet[],
  players: readonly Player[],
): RankingBook {
  if (source.kind === "default") return defaultBook(players, source.format);
  const set = sets.find((candidate) => candidate.id === source.setId);
  // A source pointing at a deleted set falls back rather than blanking the board.
  return set ? customBook(set, players) : defaultBook(players, "ppr");
}

/** Comparator over a book, for any list that should follow ranking order. */
export const byBook =
  (book: RankingBook) =>
  (a: Player, b: Player): number =>
    rankValue(book.entry(a.id)) - rankValue(book.entry(b.id));
