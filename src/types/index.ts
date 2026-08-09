/**
 * Domain types for the draft companion.
 *
 * Rank, pick number and team index are all small integers that would otherwise
 * be trivially swappable at a call site, so each is branded.
 */

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type PlayerId = Brand<string, "PlayerId">;
export type PickNumber = Brand<number, "PickNumber">;
export type TeamSlot = Brand<number, "TeamSlot">;

export const playerId = (value: string) => value as PlayerId;
export const pickNumber = (value: number) => value as PickNumber;
export const teamSlot = (value: number) => value as TeamSlot;

export type Position = "QB" | "RB" | "WR" | "TE";
export const POSITIONS: readonly Position[] = ["QB", "RB", "WR", "TE"];

/** Scoring formats the guide provides rankings for. */
export type ScoringFormat = "ppr" | "half";

/** The guide colour-codes every ranked player with one of these. */
export type Sentiment = "target" | "neutral" | "pass" | "avoid";

/** Where a player's NFL club came from, so unverified joins stay visible. */
export type TeamSource = "guide" | "stated" | "news" | "prior" | "unknown";

export type NflTeam =
  | "ARI" | "ATL" | "BAL" | "BUF" | "CAR" | "CHI" | "CIN" | "CLE"
  | "DAL" | "DEN" | "DET" | "GB"  | "HOU" | "IND" | "JAX" | "KC"
  | "LAC" | "LAR" | "LV"  | "MIA" | "MIN" | "NE"  | "NO"  | "NYG"
  | "NYJ" | "PHI" | "PIT" | "SEA" | "SF"  | "TB"  | "TEN" | "WAS";

/** A player's standing in one scoring format. */
export interface FormatRank {
  /** Position on the 150-player big board. Absent for depth players. */
  readonly overall?: number;
  /** Position on the full positional list (QB32 / RB60 / WR60 / TE32). */
  readonly position: number;
  /** Derived from drop-offs in overall rank — see scripts/build_dataset.py. */
  readonly tier: number;
}

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly position: Position;
  readonly sentiment: Sentiment;
  readonly team: NflTeam | null;
  readonly teamSource: TeamSource;
  readonly byeWeek: number | null;
  readonly ranks: Partial<Record<ScoringFormat, FormatRank>>;
}

export interface LineupSlots {
  readonly QB: number;
  readonly RB: number;
  readonly WR: number;
  readonly TE: number;
  readonly FLEX: number;
  /** Superflex: a second slot that also accepts a QB. Zero disables it. */
  readonly SUPERFLEX: number;
  readonly BENCH: number;
}

export interface LeagueSettings {
  readonly teamCount: number;
  readonly rounds: number;
  /** 1-based seat the user drafts from. */
  readonly mySlot: TeamSlot;
  readonly format: ScoringFormat;
  readonly lineup: LineupSlots;
}

export interface Pick {
  readonly pick: PickNumber;
  readonly slot: TeamSlot;
  readonly round: number;
  readonly playerId: PlayerId;
}

export interface DraftState {
  readonly settings: LeagueSettings;
  readonly picks: readonly Pick[];
  /** Player ids the user has starred, independent of the draft. */
  readonly favorites: readonly PlayerId[];
  /** Ordered shortlist of who to take next. */
  readonly queue: readonly PlayerId[];
}
