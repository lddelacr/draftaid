"use client";

import { useMemo, useState } from "react";
import type { LineupSlots, Player } from "@/types";
import { PLAYERS } from "@/lib/data/players";
import { useDraft, useHotkeys } from "@/hooks/useDraft";
import { useTheme } from "@/hooks/useTheme";
import { EMPTY_FILTERS, useFilteredPlayers } from "@/hooks/useFilteredPlayers";
import { available, currentPick, inFormat, myRoster, rankedBoard } from "@/lib/draft/selectors";
import { rosterByTeam } from "@/lib/draft/stacks";
import { rosterSize } from "@/lib/scoring/formats";
import { DraftClock } from "@/components/draft/DraftClock";
import { DraftHistory, LineupCard } from "@/components/draft/RightRail";
import { OverallBoard } from "@/components/board/OverallBoard";
import { PositionColumns } from "@/components/board/PositionColumns";
import { CommandPalette } from "@/components/board/CommandPalette";

/**
 * Three panes, following the layout the reference got right: the guide's top
 * 150 on the left, best available by position in the middle, drafted players
 * and your lineup on the right.
 */
export function DraftShell() {
  const { state, actions, hydrated } = useDraft();
  const { theme, toggle: toggleTheme } = useTheme();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const format = state.settings.format;
  const open = useMemo(() => inFormat(available(state, PLAYERS), format), [state, format]);
  const board = useMemo(() => rankedBoard(open, format), [open, format]);
  const visible = useFilteredPlayers(board, filters, state.favorites);

  useHotkeys(
    useMemo(
      () => ({
        "mod+k": () => setPaletteOpen((value) => !value),
        "mod+z": () => actions.undo(),
        "/": () => setPaletteOpen(true),
        escape: () => setPaletteOpen(false),
      }),
      [actions],
    ),
  );

  const favorites = useMemo(() => new Set(state.favorites), [state.favorites]);

  /** Clubs already on your roster, for the stack and overlap chips. */
  const myTeams = useMemo(() => rosterByTeam(myRoster(state, PLAYERS)), [state]);
  const draft = (player: Player) => actions.draft(player.id);
  const star = (player: Player) => actions.favorite(player.id);

  /** Roster size drives round count, so the two can never disagree. */
  const setLineup = (lineup: LineupSlots) =>
    actions.updateSettings({ ...state.settings, lineup, rounds: rosterSize(lineup) });

  if (!hydrated) {
    return <div className="grid h-dvh place-items-center text-sm text-dim">Loading board…</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <DraftClock
        state={state}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSettings={actions.updateSettings}
        onUndo={actions.undo}
        onReset={actions.reset}
      />

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-2 lg:grid-cols-[19rem_minmax(0,1fr)_19rem] lg:overflow-hidden">
        <OverallBoard
          players={visible}
          format={format}
          filters={filters}
          favorites={favorites}
          currentPick={currentPick(state)}
          myTeams={myTeams}
          onFilters={setFilters}
          onDraft={draft}
          onFavorite={star}
        />

        <div className="flex min-h-0 flex-col gap-2">
          <PositionColumns
            players={open}
            format={format}
            favorites={favorites}
            myTeams={myTeams}
            onDraft={draft}
            onFavorite={star}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <LineupCard state={state} players={PLAYERS} onLineup={setLineup} />
          <DraftHistory
            state={state}
            players={PLAYERS}
            onRemove={(playerId) => actions.raw({ type: "remove", playerId })}
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        players={open}
        format={format}
        onClose={() => setPaletteOpen(false)}
        onDraft={draft}
      />
    </div>
  );
}
