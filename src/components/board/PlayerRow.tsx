"use client";

import { memo } from "react";
import { Ban, Star } from "lucide-react";
import type { Player } from "@/types";
import type { RankedEntry } from "@/lib/rankings/book";
import { cn } from "@/lib/utils";
import {
  POSITION_ABBR,
  POSITION_STYLES,
  SENTIMENT_DOT,
  SENTIMENT_LABEL,
  SENTIMENT_TAG,
  SENTIMENT_WORD,
} from "@/lib/presentation";
import type { StackSignal } from "@/lib/draft/stacks";
import { StackChip, conflictTitle } from "./StackChip";

interface PlayerRowProps {
  player: Player;
  /** Resolved standing from the active ranking book. */
  rank: RankedEntry | undefined;
  /**
   * "full" is the overall board: rank, bye, and the guide's mark as a dot.
   * "compact" is a position column: the guide's mark tints the whole row and
   * is spelled out, since there is room for a word where there is no rank.
   */
  variant?: "full" | "compact";
  /** Picks the board has run past this player's rank. Undefined hides it. */
  slide?: number;
  /** Correlation with clubs already on your roster. */
  signals?: readonly StackSignal[];
  isFavorite?: boolean;
  onDraft: (player: Player) => void;
  onFavorite?: (player: Player) => void;
}

function PlayerRowImpl({
  player,
  rank,
  variant = "full",
  slide,
  signals,
  isFavorite = false,
  onDraft,
  onFavorite,
}: PlayerRowProps) {
  const full = variant === "full";
  const sentiment = rank?.sentiment ?? "neutral";
  const marked = sentiment !== "neutral";

  const conflict = signals?.find((signal) => signal.kind === "conflict");
  const conflictNames = conflict?.partners.map((partner) => partner.name).join(", ");

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onDraft(player)}
        title={`Draft ${player.name}`}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 text-left transition-colors",
          "hover:bg-sunken focus-visible:bg-sunken",
          full ? "py-1.5" : "py-1",
        )}
      >
        {full && (
          <span className="tnum w-7 shrink-0 text-right text-2xs text-dim">
            {rank?.overall ?? "—"}
          </span>
        )}

        <span
          className={cn(
            "tnum shrink-0 rounded px-1 py-px text-center text-2xs font-medium",
            POSITION_STYLES[player.position],
            full ? "w-9" : "w-8",
          )}
        >
          {/* A player ranked in one format may be absent from the other. */}
          {full
            ? `${POSITION_ABBR[player.position]}${rank?.position ?? ""}`
            : (rank?.position ?? POSITION_ABBR[player.position])}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {full && marked && (
            <span
              title={SENTIMENT_LABEL[sentiment]}
              aria-label={SENTIMENT_LABEL[sentiment]}
              className={cn("size-1.5 shrink-0 rounded-full", SENTIMENT_DOT[sentiment])}
            />
          )}
          <span className="truncate text-sm text-body">{player.name}</span>
          {signals?.map((signal) => (
            <StackChip key={signal.kind} signal={signal} showName={!full} />
          ))}
          {slide !== undefined && slide > 0 && (
            <span
              title={`Still available ${slide} picks past your rank`}
              className="tnum shrink-0 rounded bg-target/10 px-1 text-2xs text-target"
            >
              +{slide}
            </span>
          )}
        </span>

        {!full && marked && (
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px text-2xs font-medium",
              SENTIMENT_TAG[sentiment],
            )}
          >
            {SENTIMENT_WORD[sentiment]}
          </span>
        )}

        <span
          title={
            conflict && player.team
              ? conflictTitle(conflictNames ?? "", player.team)
              : undefined
          }
          className={cn(
            "tnum flex shrink-0 items-center gap-0.5 rounded px-1 text-2xs",
            conflict ? "bg-avoid/15 font-medium text-avoid" : "text-muted",
          )}
        >
          {conflict && <Ban className="size-2.5 shrink-0" />}
          {player.team ?? "—"}
        </span>

        {full && (
          <span className="tnum w-6 shrink-0 text-right text-2xs text-dim">
            {player.byeWeek ?? "—"}
          </span>
        )}
      </button>

      {onFavorite && (
        <button
          type="button"
          title={isFavorite ? "Unstar" : "Star"}
          aria-label={isFavorite ? "Unstar" : "Star"}
          onClick={(event) => {
            event.stopPropagation();
            onFavorite(player);
          }}
          className={cn(
            "absolute right-1 top-1/2 hidden -translate-y-1/2 rounded bg-panel/95 p-1 shadow-sm transition-colors",
            "group-hover:block group-focus-within:block",
            isFavorite ? "block text-accent" : "text-dim hover:text-body",
          )}
        >
          <Star className={cn("size-3.5", isFavorite && "fill-current")} />
        </button>
      )}
    </div>
  );
}

export const PlayerRow = memo(PlayerRowImpl);
