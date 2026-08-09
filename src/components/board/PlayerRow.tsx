"use client";

import { memo } from "react";
import { Star } from "lucide-react";
import type { Player, ScoringFormat } from "@/types";
import { cn } from "@/lib/utils";
import { POSITION_STYLES, SENTIMENT_DOT, SENTIMENT_LABEL, TEAM_SOURCE_NOTE } from "@/lib/presentation";
import type { StackSignal } from "@/lib/draft/stacks";
import { StackChip } from "./StackChip";

interface PlayerRowProps {
  player: Player;
  format: ScoringFormat;
  /** The overall board shows rank and slide; the position columns show less. */
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
  format,
  variant = "full",
  slide,
  signals,
  isFavorite = false,
  onDraft,
  onFavorite,
}: PlayerRowProps) {
  const rank = player.ranks[format];
  const unverified = TEAM_SOURCE_NOTE[player.teamSource];
  const full = variant === "full";

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
          {/* Guard: a player ranked in one format may be absent from the other. */}
          {full ? `${player.position}${rank?.position ?? ""}` : (rank?.position ?? player.position)}
        </span>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {player.sentiment !== "neutral" && (
            <span
              title={SENTIMENT_LABEL[player.sentiment]}
              aria-label={SENTIMENT_LABEL[player.sentiment]}
              className={cn("size-1.5 shrink-0 rounded-full", SENTIMENT_DOT[player.sentiment])}
            />
          )}
          <span className="truncate text-sm text-body">{player.name}</span>
          {signals?.map((signal) => <StackChip key={signal.kind} signal={signal} />)}
          {slide !== undefined && slide > 0 && (
            <span
              title={`Still available ${slide} picks past your rank`}
              className="tnum shrink-0 rounded bg-target/10 px-1 text-2xs text-target"
            >
              +{slide}
            </span>
          )}
        </span>

        <span
          title={unverified ?? undefined}
          className={cn(
            "tnum shrink-0 text-2xs",
            unverified ? "text-dim underline decoration-dotted" : "text-muted",
          )}
        >
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
            isFavorite ? "text-accent" : "text-dim hover:text-body",
            isFavorite && "block",
          )}
        >
          <Star className={cn("size-3.5", isFavorite && "fill-current")} />
        </button>
      )}
    </div>
  );
}

export const PlayerRow = memo(PlayerRowImpl);
