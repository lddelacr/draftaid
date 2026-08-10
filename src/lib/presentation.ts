import type { Position, Sentiment, TeamSource } from "@/types";

/**
 * Presentation vocabulary, in one place so the board, the position columns and
 * the command palette can never disagree about what a colour means.
 */

/** Muted position tints — enough to pattern-match a column, not enough to
 *  compete with the guide's own target/pass/avoid marks. */
export const POSITION_STYLES: Record<Position, string> = {
  QB: "text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/15",
  RB: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15",
  WR: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15",
  TE: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15",
};

export const POSITION_ACCENT: Record<Position, string> = {
  QB: "bg-rose-500",
  RB: "bg-emerald-500",
  WR: "bg-sky-500",
  TE: "bg-amber-500",
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  target: "Target",
  pass: "Passing",
  avoid: "Avoiding",
  neutral: "",
};

export const SENTIMENT_DOT: Record<Sentiment, string> = {
  target: "bg-target",
  pass: "bg-pass",
  avoid: "bg-avoid",
  neutral: "bg-transparent",
};

export const TEAM_SOURCE_NOTE: Record<TeamSource, string | null> = {
  guide: null,
  stated: null,
  news: null,
  prior: "Club carried from 2025 — not verified for 2026",
  unknown: "Club unknown",
};

/**
 * Tag treatment for the position columns. The colour sits on the tag alone —
 * washing the whole row put three competing tints on screen at once and made
 * the columns harder to scan, not easier.
 */
export const SENTIMENT_TAG: Record<Sentiment, string> = {
  target: "bg-target/10 text-target",
  pass: "bg-pass/15 text-pass",
  avoid: "bg-avoid/10 text-avoid",
  neutral: "",
};

export const SENTIMENT_WORD: Record<Sentiment, string> = {
  target: "Target",
  pass: "Pass",
  avoid: "Avoid",
  neutral: "",
};
