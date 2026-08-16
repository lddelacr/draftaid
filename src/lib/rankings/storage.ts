import type { PlayerId, RankingSet, RankingSource, ScoringFormat, Sentiment } from "@/types";

/**
 * Ranking sets persist under their own key, deliberately separate from the
 * draft. A corrupt ranking payload must never take a live draft down with it,
 * and switching sets must never look like a draft mutation.
 */

const KEY = "draftaid:rankings:v1";
const VERSION = 1;

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

/**
 * Anything hand-edited, half-written or left by an older build reaches this
 * function, so every field is checked rather than trusted. A set that fails
 * validation is dropped; one bad set does not discard the rest.
 */
function parseSet(raw: unknown): RankingSet | null {
  if (!isRecord(raw)) return null;
  const { id, name, format, createdAt, updatedAt, entries, tierNames } = raw;

  if (typeof id !== "string" || !id) return null;
  if (typeof name !== "string" || !name) return null;
  if (!Array.isArray(entries)) return null;

  const parsedEntries = entries.flatMap((entry): RankingSet["entries"][number][] => {
    if (!isRecord(entry) || typeof entry.playerId !== "string") return [];
    const tier = Number(entry.tier);
    const sentiment = SENTIMENTS.includes(entry.sentiment as Sentiment)
      ? (entry.sentiment as Sentiment)
      : "neutral";
    return [
      {
        playerId: entry.playerId as PlayerId,
        tier: Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 1,
        sentiment,
      },
    ];
  });

  const names: Record<number, string> = {};
  if (isRecord(tierNames)) {
    for (const [key, value] of Object.entries(tierNames)) {
      const tier = Number(key);
      if (Number.isFinite(tier) && typeof value === "string") names[tier] = value;
    }
  }

  return {
    id,
    name,
    format: FORMATS.includes(format as ScoringFormat) ? (format as ScoringFormat) : "ppr",
    createdAt: Number.isFinite(Number(createdAt)) ? Number(createdAt) : Date.now(),
    updatedAt: Number.isFinite(Number(updatedAt)) ? Number(updatedAt) : Date.now(),
    entries: parsedEntries,
    tierNames: names,
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
