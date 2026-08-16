import {
  type Player,
  type PlayerId,
  type RankingEntry,
  type RankingSet,
  type ScoringFormat,
  type Sentiment,
} from "@/types";

/**
 * Pure operations over ranking sets. No React, no storage — every function
 * takes a set and returns a new one, so the editor's undo stack is just an
 * array of past sets and nothing can mutate a set in place.
 */

const now = () => Date.now();

const touch = (set: RankingSet, entries: readonly RankingEntry[]): RankingSet => ({
  ...set,
  entries,
  updatedAt: now(),
});

export const newId = (): string =>
  `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Names are how the user tells sets apart, so a collision gets a numeric
 * suffix rather than silently producing two identical entries in the switcher.
 */
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

/** Clone the guide's order, tiers and marks into a set the user owns. */
export function fromDefault(
  name: string,
  format: ScoringFormat,
  players: readonly Player[],
  existing: readonly RankingSet[],
): RankingSet {
  const entries: RankingEntry[] = players
    .filter((player) => player.ranks[format] !== undefined)
    .sort((a, b) => {
      const left = a.ranks[format];
      const right = b.ranks[format];
      const leftRank = left?.overall ?? 900 + (left?.position ?? 99);
      const rightRank = right?.overall ?? 900 + (right?.position ?? 99);
      return leftRank - rightRank;
    })
    .map((player) => ({
      playerId: player.id,
      tier: player.ranks[format]?.tier ?? 1,
      sentiment: player.sentiment,
    }));

  return {
    id: newId(),
    name: uniqueName(name, existing),
    format,
    createdAt: now(),
    updatedAt: now(),
    entries,
    tierNames: {},
  };
}

export function blank(
  name: string,
  format: ScoringFormat,
  existing: readonly RankingSet[],
): RankingSet {
  return {
    id: newId(),
    name: uniqueName(name, existing),
    format,
    createdAt: now(),
    updatedAt: now(),
    entries: [],
    tierNames: {},
  };
}

export function duplicate(
  set: RankingSet,
  existing: readonly RankingSet[],
): RankingSet {
  return {
    ...set,
    id: newId(),
    name: uniqueName(`${set.name} copy`, existing),
    createdAt: now(),
    updatedAt: now(),
  };
}

export const rename = (
  set: RankingSet,
  name: string,
  existing: readonly RankingSet[],
): RankingSet => ({
  ...set,
  name: uniqueName(name, existing.filter((other) => other.id !== set.id)),
  updatedAt: now(),
});

/**
 * Move one player to a new index.
 *
 * The dropped player inherits the tier of whoever they land next to, which is
 * what "drag into that tier" means visually — without it, dragging a player
 * into the middle of tier 3 would leave them labelled tier 7.
 */
export function moveEntry(set: RankingSet, from: number, to: number): RankingSet {
  const entries = [...set.entries];
  const moving = entries[from];
  if (!moving || from === to || to < 0 || to >= entries.length) return set;

  entries.splice(from, 1);
  entries.splice(to, 0, moving);

  const neighbour = entries[to - 1] ?? entries[to + 1];
  const adopted = neighbour ? neighbour.tier : moving.tier;
  entries[to] = { ...moving, tier: adopted };

  return touch(set, entries);
}

/** Nudge by one place, for keyboard reordering. */
export const nudge = (set: RankingSet, index: number, delta: number): RankingSet =>
  moveEntry(set, index, index + delta);

export function setSentiment(
  set: RankingSet,
  playerId: PlayerId,
  sentiment: Sentiment,
): RankingSet {
  const entries = set.entries.map((entry) =>
    entry.playerId === playerId ? { ...entry, sentiment } : entry,
  );
  return touch(set, entries);
}

/**
 * Start a new tier at `index`: that player and everyone below them shift down
 * one tier, which keeps tier numbers contiguous and ascending.
 */
export function splitTierAt(set: RankingSet, index: number): RankingSet {
  const target = set.entries[index];
  if (!target || index === 0) return set;

  const entries = set.entries.map((entry, position) =>
    position >= index ? { ...entry, tier: entry.tier + 1 } : entry,
  );
  return touch(set, entries);
}

/** Merge a tier into the one above it, closing the gap below. */
export function mergeTierUp(set: RankingSet, tier: number): RankingSet {
  if (tier <= 1) return set;
  const entries = set.entries.map((entry) =>
    entry.tier >= tier ? { ...entry, tier: entry.tier - 1 } : entry,
  );
  return touch(set, entries);
}

export const nameTier = (set: RankingSet, tier: number, label: string): RankingSet => {
  const tierNames = { ...set.tierNames };
  if (label.trim()) tierNames[tier] = label.trim();
  else delete tierNames[tier];
  return { ...set, tierNames, updatedAt: now() };
};

/** Add a player a blank set (or a stale one) does not yet carry. */
export function addPlayer(set: RankingSet, playerId: PlayerId): RankingSet {
  if (set.entries.some((entry) => entry.playerId === playerId)) return set;
  const tier = set.entries.at(-1)?.tier ?? 1;
  return touch(set, [...set.entries, { playerId, tier, sentiment: "neutral" }]);
}

export const removePlayer = (set: RankingSet, playerId: PlayerId): RankingSet =>
  touch(
    set,
    set.entries.filter((entry) => entry.playerId !== playerId),
  );

/**
 * Players the dataset has but this set does not — a blank set has all of them,
 * and a set built before a guide update has whatever was added since.
 */
export const missingFrom = (
  set: RankingSet,
  players: readonly Player[],
): Player[] => {
  const held = new Set(set.entries.map((entry) => entry.playerId));
  return players.filter((player) => !held.has(player.id));
};

/** Renumber tiers to 1..n in order, closing any gaps left by editing. */
export function normaliseTiers(set: RankingSet): RankingSet {
  let previous: number | null = null;
  let next = 0;
  const entries = set.entries.map((entry) => {
    if (entry.tier !== previous) {
      previous = entry.tier;
      next += 1;
    }
    return { ...entry, tier: next };
  });
  return touch(set, entries);
}
