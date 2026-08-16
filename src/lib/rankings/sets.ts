import {
  SKILL_POSITIONS,
  type Player,
  type PlayerId,
  type PositionalTiers,
  type RankingSet,
  type RankingTier,
  type ScoringFormat,
  type Sentiment,
  type SkillPosition,
} from "@/types";

/**
 * Pure operations over ranking sets. No React, no storage — every function
 * takes a set and returns a new one, so undo is a stack of past sets and
 * nothing can be mutated in place.
 *
 * Each operation touches exactly one of the three pieces of state. A tier move
 * never rewrites `overall`, and an overall move never rewrites a tier. That
 * separation is enforced here rather than left to callers to remember.
 */

const now = () => Date.now();

const touch = (set: RankingSet, patch: Partial<RankingSet>): RankingSet => ({
  ...set,
  ...patch,
  updatedAt: now(),
});

export const newId = (prefix = "rs"): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Names are how sets are told apart, so collisions get a numeric suffix. */
export function uniqueName(name: string, existing: readonly RankingSet[]): string {
  const taken = new Set(existing.map((set) => set.name.trim().toLowerCase()));
  const base = name.trim() || "Untitled rankings";
  if (!taken.has(base.toLowerCase())) return base;
  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `${base} ${newId()}`;
}

export const emptyPositional = (): PositionalTiers => ({
  QB: [],
  RB: [],
  WR: [],
  TE: [],
});

export const makeTier = (name: string, playerIds: readonly PlayerId[] = []): RankingTier => ({
  id: newId("tier"),
  name,
  playerIds,
});

/* ------------------------------------------------------------------ create */

/**
 * Clone the guide into a set the user owns: its overall order, its per-position
 * tier groupings, and its target/pass/avoid marks. Rebuilding 250 players by
 * hand is nobody's workflow, so this is the default path.
 */
export function fromDefault(
  name: string,
  format: ScoringFormat,
  players: readonly Player[],
  existing: readonly RankingSet[],
): RankingSet {
  const ranked = players.filter((player) => player.ranks[format] !== undefined);

  const overall = ranked
    .filter((player) => player.ranks[format]?.overall !== undefined)
    .sort((a, b) => (a.ranks[format]?.overall ?? 0) - (b.ranks[format]?.overall ?? 0))
    .map((player) => player.id);

  const positional = emptyPositional() as Record<SkillPosition, RankingTier[]>;
  for (const position of SKILL_POSITIONS) {
    const pool = ranked
      .filter((player) => player.position === position)
      .sort((a, b) => (a.ranks[format]?.position ?? 0) - (b.ranks[format]?.position ?? 0));

    // The guide's tier numbers can have gaps; renumber to a contiguous ladder.
    const grouped = new Map<number, PlayerId[]>();
    for (const player of pool) {
      const tier = player.ranks[format]?.tier ?? 1;
      grouped.set(tier, [...(grouped.get(tier) ?? []), player.id]);
    }
    positional[position] = [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, playerIds], index) => makeTier(`Tier ${index + 1}`, playerIds));
  }

  const designations: Record<string, Sentiment> = {};
  for (const player of ranked) {
    if (player.sentiment !== "neutral") designations[player.id] = player.sentiment;
  }

  return {
    id: newId(),
    name: uniqueName(name, existing),
    format,
    createdAt: now(),
    updatedAt: now(),
    positional,
    overall,
    designations,
  };
}

/** A blank set still gets one empty tier per position, so there is a drop target. */
export function blank(
  name: string,
  format: ScoringFormat,
  existing: readonly RankingSet[],
): RankingSet {
  const positional = emptyPositional() as Record<SkillPosition, RankingTier[]>;
  for (const position of SKILL_POSITIONS) positional[position] = [makeTier("Tier 1")];

  return {
    id: newId(),
    name: uniqueName(name, existing),
    format,
    createdAt: now(),
    updatedAt: now(),
    positional,
    overall: [],
    designations: {},
  };
}

export const duplicate = (set: RankingSet, existing: readonly RankingSet[]): RankingSet => ({
  ...set,
  id: newId(),
  name: uniqueName(`${set.name} copy`, existing),
  createdAt: now(),
  updatedAt: now(),
});

export const rename = (
  set: RankingSet,
  name: string,
  existing: readonly RankingSet[],
): RankingSet => ({
  ...set,
  name: uniqueName(name, existing.filter((other) => other.id !== set.id)),
  updatedAt: now(),
});

/* ------------------------------------------------- positional tier editing */

const withTiers = (
  set: RankingSet,
  position: SkillPosition,
  tiers: readonly RankingTier[],
): RankingSet =>
  touch(set, { positional: { ...set.positional, [position]: tiers } });

export const tiersFor = (set: RankingSet, position: SkillPosition): readonly RankingTier[] =>
  set.positional[position] ?? [];

export const addTier = (set: RankingSet, position: SkillPosition): RankingSet =>
  withTiers(set, position, [
    ...tiersFor(set, position),
    makeTier(`Tier ${tiersFor(set, position).length + 1}`),
  ]);

export const renameTier = (
  set: RankingSet,
  position: SkillPosition,
  tierId: string,
  name: string,
): RankingSet =>
  withTiers(
    set,
    position,
    tiersFor(set, position).map((tier) => (tier.id === tierId ? { ...tier, name } : tier)),
  );

/** Deleting a tier returns its players to the pool rather than dropping them. */
export const deleteTier = (
  set: RankingSet,
  position: SkillPosition,
  tierId: string,
): RankingSet =>
  withTiers(
    set,
    position,
    tiersFor(set, position).filter((tier) => tier.id !== tierId),
  );

export const clearTier = (
  set: RankingSet,
  position: SkillPosition,
  tierId: string,
): RankingSet =>
  withTiers(
    set,
    position,
    tiersFor(set, position).map((tier) =>
      tier.id === tierId ? { ...tier, playerIds: [] } : tier,
    ),
  );

export function moveTier(
  set: RankingSet,
  position: SkillPosition,
  from: number,
  to: number,
): RankingSet {
  const tiers = [...tiersFor(set, position)];
  const moving = tiers[from];
  if (!moving || to < 0 || to >= tiers.length || from === to) return set;
  tiers.splice(from, 1);
  tiers.splice(to, 0, moving);
  return withTiers(set, position, tiers);
}

/**
 * Place a player into a tier at a given index, removing them from wherever
 * they were. Passing a null tier returns them to the pool.
 *
 * This never touches `overall` — a player dragged between tiers keeps his draft
 * rank, which is the whole point of the two being separate.
 */
export function placePlayer(
  set: RankingSet,
  position: SkillPosition,
  playerId: PlayerId,
  tierId: string | null,
  index?: number,
): RankingSet {
  const stripped = tiersFor(set, position).map((tier) => ({
    ...tier,
    playerIds: tier.playerIds.filter((id) => id !== playerId),
  }));

  if (tierId === null) return withTiers(set, position, stripped);

  const tiers = stripped.map((tier) => {
    if (tier.id !== tierId) return tier;
    const playerIds = [...tier.playerIds];
    const at = index === undefined ? playerIds.length : Math.max(0, Math.min(index, playerIds.length));
    playerIds.splice(at, 0, playerId);
    return { ...tier, playerIds };
  });

  return withTiers(set, position, tiers);
}

/** Players at a position that no tier holds yet. */
export function poolFor(
  set: RankingSet,
  position: SkillPosition,
  players: readonly Player[],
): Player[] {
  const placed = new Set<string>(
    tiersFor(set, position).flatMap((tier) => [...tier.playerIds]),
  );
  return players.filter(
    (player) => player.position === position && !placed.has(player.id),
  );
}

/* -------------------------------------------------------- overall ranking */

/**
 * Move a player to a new overall rank. Everything between shifts by one, and
 * ranks are read off the array index rather than stored, so they can never
 * drift out of sequence.
 *
 * This never touches positional tiers.
 */
export function moveOverall(set: RankingSet, from: number, to: number): RankingSet {
  const overall = [...set.overall];
  const moving = overall[from];
  if (!moving || from === to || to < 0 || to >= overall.length) return set;
  overall.splice(from, 1);
  overall.splice(to, 0, moving);
  return touch(set, { overall });
}

export function addToOverall(set: RankingSet, playerId: PlayerId, index?: number): RankingSet {
  if (set.overall.includes(playerId)) return set;
  const overall = [...set.overall];
  const at = index === undefined ? overall.length : Math.max(0, Math.min(index, overall.length));
  overall.splice(at, 0, playerId);
  return touch(set, { overall });
}

export const removeFromOverall = (set: RankingSet, playerId: PlayerId): RankingSet =>
  touch(set, { overall: set.overall.filter((id) => id !== playerId) });

/** Players the dataset has that the overall list does not carry. */
export const missingFromOverall = (
  set: RankingSet,
  players: readonly Player[],
): Player[] => {
  const held = new Set<string>(set.overall);
  return players.filter((player) => !held.has(player.id));
};

/* ------------------------------------------------------------ designation */

/**
 * Designations are mutually exclusive by construction — one key per player, so
 * marking a target as avoid simply overwrites. Setting "neutral" removes the
 * key rather than storing it, which keeps saved sets small.
 */
export function designate(
  set: RankingSet,
  playerId: PlayerId,
  sentiment: Sentiment,
): RankingSet {
  const designations = { ...set.designations };
  if (sentiment === "neutral") delete designations[playerId];
  else designations[playerId] = sentiment;
  return touch(set, { designations });
}
