import {
  SKILL_POSITIONS,
  type PlayerId,
  type PositionalTiers,
  type RankingSet,
  type RankingSource,
  type RankingTier,
  type ScoringFormat,
  type Sentiment,
  type SkillPosition,
} from "@/types";
import { emptyPositional, makeTier, newId } from "./sets";

/**
 * Ranking sets persist under their own key, deliberately separate from the
 * draft. A corrupt ranking payload must never take a live draft down with it,
 * and switching sets must never look like a draft mutation.
 */

const KEY = "draftaid:rankings:v1";
const VERSION = 2;

export interface RankingStore {
  readonly version: number;
  readonly sets: readonly RankingSet[];
  readonly active: RankingSource;
}

export const EMPTY_STORE: RankingStore = {
  version: VERSION,
  sets: [],
  active: { kind: "default", format: "ppr" },
};

const SENTIMENTS: readonly Sentiment[] = ["target", "neutral", "pass", "avoid"];
const FORMATS: readonly ScoringFormat[] = ["ppr", "half"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stringList = (value: unknown): PlayerId[] =>
  Array.isArray(value) ? (value.filter((id) => typeof id === "string") as PlayerId[]) : [];

function parseTiers(raw: unknown): RankingTier[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): RankingTier[] => {
    if (!isRecord(entry)) return [];
    return [
      {
        id: typeof entry.id === "string" && entry.id ? entry.id : newId("tier"),
        name: typeof entry.name === "string" && entry.name ? entry.name : "Tier",
        playerIds: stringList(entry.playerIds),
      },
    ];
  });
}

/**
 * Version 1 stored one flat entry list where array order was overall rank and
 * a `tier` number rode along on each entry. Reading it forward keeps the order
 * as the overall list and rebuilds each position's ladder from those numbers,
 * so a set made before the tier board existed still opens.
 */
function migrateV1(raw: Record<string, unknown>): Partial<RankingSet> | null {
  if (!Array.isArray(raw.entries)) return null;

  const overall: PlayerId[] = [];
  const designations: Record<string, Sentiment> = {};
  const tiersByPlayer = new Map<string, number>();

  for (const entry of raw.entries) {
    if (!isRecord(entry) || typeof entry.playerId !== "string") continue;
    overall.push(entry.playerId as PlayerId);
    const tier = Number(entry.tier);
    tiersByPlayer.set(entry.playerId, Number.isFinite(tier) && tier > 0 ? tier : 1);
    if (SENTIMENTS.includes(entry.sentiment as Sentiment) && entry.sentiment !== "neutral") {
      designations[entry.playerId] = entry.sentiment as Sentiment;
    }
  }

  // Positions are unknown here (no player data at parse time), so v1 tiers are
  // rebuilt as a single ladder the editor can redistribute rather than guessed.
  const positional = emptyPositional() as Record<SkillPosition, RankingTier[]>;
  for (const position of SKILL_POSITIONS) positional[position] = [makeTier("Tier 1")];

  return { overall, designations, positional };
}

function parseSet(raw: unknown): RankingSet | null {
  if (!isRecord(raw)) return null;
  const { id, name, format, createdAt, updatedAt } = raw;

  if (typeof id !== "string" || !id) return null;
  if (typeof name !== "string" || !name) return null;

  const legacy = raw.entries !== undefined ? migrateV1(raw) : null;

  const positional = emptyPositional() as Record<SkillPosition, RankingTier[]>;
  if (isRecord(raw.positional)) {
    for (const position of SKILL_POSITIONS) {
      positional[position] = parseTiers(raw.positional[position]);
    }
  } else if (legacy?.positional) {
    for (const position of SKILL_POSITIONS) {
      positional[position] = [...(legacy.positional[position] ?? [])];
    }
  }

  const designations: Record<string, Sentiment> = {};
  const rawDesignations = isRecord(raw.designations) ? raw.designations : {};
  for (const [key, value] of Object.entries(rawDesignations)) {
    if (SENTIMENTS.includes(value as Sentiment) && value !== "neutral") {
      designations[key] = value as Sentiment;
    }
  }

  return {
    id,
    name,
    format: FORMATS.includes(format as ScoringFormat) ? (format as ScoringFormat) : "ppr",
    createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
    updatedAt: Number.isFinite(Number(updatedAt)) ? Number(updatedAt) : Date.now(),
    positional: positional as PositionalTiers,
    overall: Array.isArray(raw.overall) ? stringList(raw.overall) : (legacy?.overall ?? []),
    designations: Object.keys(designations).length ? designations : (legacy?.designations ?? {}),
  };
}

function parseSource(raw: unknown, sets: readonly RankingSet[]): RankingSource {
  if (!isRecord(raw)) return EMPTY_STORE.active;

  if (raw.kind === "custom" && typeof raw.setId === "string") {
    // A pointer at a set that no longer exists falls back to the guide.
    return sets.some((set) => set.id === raw.setId)
      ? { kind: "custom", setId: raw.setId }
      : EMPTY_STORE.active;
  }
  if (raw.kind === "default") {
    const format = FORMATS.includes(raw.format as ScoringFormat)
      ? (raw.format as ScoringFormat)
      : "ppr";
    return { kind: "default", format };
  }
  return EMPTY_STORE.active;
}

export function loadRankings(): RankingStore {
  if (typeof window === "undefined") return EMPTY_STORE;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STORE;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_STORE;

    const sets = Array.isArray(parsed.sets)
      ? parsed.sets.flatMap((entry) => {
          const set = parseSet(entry);
          return set ? [set] : [];
        })
      : [];

    return { version: VERSION, sets, active: parseSource(parsed.active, sets) };
  } catch {
    // Unparseable storage is treated as no storage. The default guide always
    // works, so the app stays usable rather than failing to boot.
    return EMPTY_STORE;
  }
}

export function saveRankings(store: RankingStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...store, version: VERSION }));
  } catch {
    // Quota or private-mode failures are non-fatal: the session keeps working,
    // it just will not survive a refresh.
  }
}
