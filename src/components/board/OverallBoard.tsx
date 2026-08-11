"use client";

import { Search, Star } from "lucide-react";
import type { NflTeam, Player, ScoringFormat } from "@/types";
import { cn } from "@/lib/utils";
import { SENTIMENT_DOT, SENTIMENT_LABEL } from "@/lib/presentation";
import type { BoardFilters } from "@/hooks/useFilteredPlayers";
import { stackSignals } from "@/lib/draft/stacks";
import { PlayerRow } from "./PlayerRow";
import { Panel, PanelBody, PanelHeader } from "@/components/layout/Panel";

interface OverallBoardProps {
  players: readonly Player[];
  format: ScoringFormat;
  filters: BoardFilters;
  favorites: ReadonlySet<string>;
  /** Current pick, used to show how far a player has slid past his rank. */
  currentPick: number;
  /** Your roster grouped by club, for stack and overlap chips. */
  myTeams: Map<NflTeam, Player[]>;
  onFilters: (filters: BoardFilters) => void;
  onDraft: (player: Player) => void;
  onFavorite: (player: Player) => void;
}

export function OverallBoard({
  players,
  format,
  filters,
  favorites,
  currentPick,
  myTeams,
  onFilters,
  onDraft,
  onFavorite,
}: OverallBoardProps) {
  return (
    <Panel>
      <PanelHeader title="Overall rankings" count={players.length} />

      <div className="space-y-2 border-b border-line px-2.5 pb-2.5">
        <div className="flex items-center gap-1.5">
          <label className="relative flex flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-dim" />
            <input
              value={filters.query}
              onChange={(event) => onFilters({ ...filters, query: event.target.value })}
              placeholder="Search"
              className={cn(
                "w-full rounded-md border border-line bg-sunken py-1.5 pl-8 pr-2 text-sm",
                "text-body placeholder:text-dim focus:border-accent/40 focus:bg-panel",
              )}
            />
          </label>
          <button
            type="button"
            aria-pressed={filters.favoritesOnly}
            title="Show starred only"
            onClick={() => onFilters({ ...filters, favoritesOnly: !filters.favoritesOnly })}
            className={cn(
              "rounded-md border border-line p-1.5 transition-colors",
              filters.favoritesOnly
                ? "border-accent/40 bg-accent/10 text-accent"
                : "text-dim hover:text-body",
            )}
          >
            <Star className={cn("size-3.5", filters.favoritesOnly && "fill-current")} />
          </button>
        </div>

        {/* Legend, not controls — these marks are the guide's judgement, and
            filtering the board down to them hides what is actually available. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
          <span className="uppercase tracking-wide text-dim">Guide</span>
          {(["target", "pass", "avoid"] as const).map((sentiment) => (
            <span key={sentiment} className="flex items-center gap-1">
              <span className={cn("size-1.5 rounded-full", SENTIMENT_DOT[sentiment])} />
              {SENTIMENT_LABEL[sentiment]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-line px-2 py-1 text-2xs uppercase tracking-wide text-dim">
        <span className="w-7 text-right">Rk</span>
        <span className="w-9 text-center">Pos</span>
        <span className="flex-1">Player</span>
        <span>Team</span>
        <span className="w-6 text-right">Bye</span>
      </div>

      <PanelBody>
        {players.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-dim">Nobody left matching that.</p>
        ) : (
          players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              format={format}
              slide={currentPick - (player.ranks[format]?.overall ?? currentPick)}
              signals={stackSignals(player, myTeams)}
              isFavorite={favorites.has(player.id)}
              onDraft={onDraft}
              onFavorite={onFavorite}
            />
          ))
        )}
      </PanelBody>

    </Panel>
  );
}
