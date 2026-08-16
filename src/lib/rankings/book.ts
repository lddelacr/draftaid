import {
  SKILL_POSITIONS,
  type Player,
  type PlayerId,
  type RankingSet,
  type RankingSource,
  type ScoringFormat,
  type Sentiment,
} from "@/types";

/**
 * A ranking book answers one question: where does this player stand?
 *
 * Every component reads standings through a book rather than off the canonical
 * player record, so the built-in guide and a user's own set are interchangeable
 * and switching between them needs no change downstream.
 *
 * For a custom set the three answers come from three different places, which is
 * the point of the model: overall rank from the overall list, tier and
 * positional rank from that position's tier ladder, designation from its own
 * map. None is derived from another.
 */

export interface RankedEntry {
  /** Draft order. Undefined when the book leaves a player off the board. */
  readonly overall?: number;
  /** Rank among players at the same position, from the tier ladder. */
  readonly position?: number;
  readonly tier?: number;
  readonly tierName?: string;
  readonly sentiment: Sentiment;
}

export interface RankingBook {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly format: ScoringFormat;
  /** Undefined when this book does not know the player at all. */
  entry(id: PlayerId): RankedEntry | undefined;
  /** Every player the book ranks, in overall order. */
  readonly ordered: readonly Player[];
}

const DEFAULT_ID = "default";

/** Sorting key. Players with no overall rank sink below those that have one. */
export const rankValue = (entry: RankedEntry | undefined): number =>
  entry === undefined ? 9999 : (entry.overall ?? 900 + (entry.position ?? 99));

/** The built-in guide. Read-only — it has no writable representation anywhere. */
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
    name: format === "ppr" ? "Default Rankings (PPR)" : "Default Rankings (Half PPR)",
    isDefault: true,
    format,
    entry: (id) => entries.get(id),
    ordered,
  };
}

/**
 * A user's set.
 *
 * A player can appear in the overall list, in a positional tier, in both, or in
 * neither — each read is independent, and a partial entry is normal rather than
 * an error. Unknown ids are skipped so a guide update that drops a player
 * cannot corrupt a saved set.
 */
export function customBook(set: RankingSet, players: readonly Player[]): RankingBook {
  const known = new Set<string>(players.map((player) => player.id));
  const byId = new Map(players.map((player) => [player.id, player]));

  const overallOf = new Map<string, number>();
  let rank = 0;
  for (const id of set.overall) {
    if (!known.has(id) || overallOf.has(id)) continue;
    rank += 1;
    overallOf.set(id, rank);
  }

  // Positional rank counts straight down that position's ladder, so tier order
  // and rank order are the same thing rather than two facts that can diverge.
  const tierOf = new Map<string, { tier: number; tierName: string; position: number }>();
  for (const position of SKILL_POSITIONS) {
    let counter = 0;
    (set.positional[position] ?? []).forEach((tier, index) => {
      for (const id of tier.playerIds) {
        if (!known.has(id) || tierOf.has(id)) continue;
        counter += 1;
        tierOf.set(id, { tier: index + 1, tierName: tier.name, position: counter });
      }
    });
  }

  const entry = (id: PlayerId): RankedEntry | undefined => {
    const overall = overallOf.get(id);
    const placed = tierOf.get(id);
    const sentiment = set.designations[id] ?? "neutral";
    if (overall === undefined && !placed && sentiment === "neutral") return undefined;
    return {
      overall,
      position: placed?.position,
      tier: placed?.tier,
      tierName: placed?.tierName,
      sentiment,
    };
  };

  const ordered = [...overallOf.entries()]
    .sort(([, a], [, b]) => a - b)
    .flatMap(([id]) => {
      const player = byId.get(id as PlayerId);
      return player ? [player] : [];
    });

  return {
    id: set.id,
    name: set.name,
    isDefault: false,
    format: set.format,
    entry,
    ordered,
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
