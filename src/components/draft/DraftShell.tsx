"use client";

import { useMemo, useState } from "react";
import type { LineupSlots, Player, RankingSet } from "@/types";
import { PLAYERS } from "@/lib/data/players";
import { useDraft, useHotkeys } from "@/hooks/useDraft";
import { useRankings } from "@/hooks/useRankings";
import { useTheme } from "@/hooks/useTheme";
import { EMPTY_FILTERS, useFilteredPlayers } from "@/hooks/useFilteredPlayers";
import { available, currentPick, inBook, myRoster, rankedBoard } from "@/lib/draft/selectors";
import { rosterByTeam } from "@/lib/draft/stacks";
import { rosterSize } from "@/lib/scoring/formats";
import { DraftClock } from "@/components/draft/DraftClock";
import { DraftHistory, LineupCard } from "@/components/draft/RightRail";
import { OverallBoard } from "@/components/board/OverallBoard";
import { PositionColumns } from "@/components/board/PositionColumns";
import { CommandPalette } from "@/components/board/CommandPalette";
import { CreateRankingsDialog } from "@/components/rankings/CreateRankingsDialog";
import { RankingEditor } from "@/components/rankings/RankingEditor";

/**
 * Three panes: the active ranking book's board on the left, best available by
 * position in the middle, your lineup and the draft log on the right.
 *
 * Draft state and ranking state are two independent hooks with two independent
 * storage keys. Nothing here copies one into the other, which is what makes
 * switching ranking sets mid-draft safe.
 */
export function DraftShell() {
  const { state, actions, hydrated } = useDraft();
  const rankings = useRankings(PLAYERS);
  const { theme, toggle: toggleTheme } = useTheme();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const book = rankings.book;
  const open = useMemo(
    () => inBook(available(state, PLAYERS, book), book),
    [state, book],
  );

  /**
   * The book's ranked board, then anyone it ranks only by position — kickers
   * and defences in the guide, or anything a custom set leaves off the overall
   * order. They sit below without displacing the ranked players.
   */
  const board = useMemo(() => {
    const ranked = rankedBoard(open, book);
    const rest = open
      .filter((player) => book.entry(player.id)?.overall === undefined)
      .sort(
        (a, b) =>
          a.position.localeCompare(b.position) ||
          (book.entry(a.id)?.position ?? 0) - (book.entry(b.id)?.position ?? 0),
      );
    return [...ranked, ...rest];
  }, [open, book]);

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
  const myTeams = useMemo(() => rosterByTeam(myRoster(state, PLAYERS)), [state]);

  const draft = (player: Player) => actions.draft(player.id);
  const star = (player: Player) => actions.favorite(player.id);

  /** Roster size drives round count, so the two can never disagree. */
  const setLineup = (lineup: LineupSlots) =>
    actions.updateSettings({ ...state.settings, lineup, rounds: rosterSize(lineup) });

  const editingSet: RankingSet | null =
    rankings.sets.find((set) => set.id === editing) ?? null;

  if (!hydrated || !rankings.hydrated) {
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
        rankingSets={rankings.sets}
        activeRanking={rankings.active}
        activeRankingName={book.name}
        onActivateRanking={rankings.actions.activate}
        onCreateRanking={() => setCreating(true)}
        onEditRanking={(set) => setEditing(set.id)}
        onDuplicateRanking={rankings.actions.duplicate}
        onDeleteRanking={(set) => rankings.actions.remove(set.id)}
      />

      <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-2 lg:grid-cols-[19rem_minmax(0,1fr)_19rem] lg:overflow-hidden">
        <OverallBoard
          players={visible}
          book={book}
          filters={filters}
          favorites={favorites}
          currentPick={currentPick(state)}
          myTeams={myTeams}
          onFilters={setFilters}
          onDraft={draft}
          onFavorite={star}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <PositionColumns
            players={open}
            book={book}
            favorites={favorites}
            myTeams={myTeams}
            onDraft={draft}
            onFavorite={star}
          />
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <LineupCard state={state} players={PLAYERS} book={book} onLineup={setLineup} />
          <DraftHistory
            state={state}
            players={PLAYERS}
            book={book}
            onRemove={(playerId) => actions.raw({ type: "remove", playerId })}
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        players={open}
        book={book}
        onClose={() => setPaletteOpen(false)}
        onDraft={draft}
      />

      {creating && (
        <CreateRankingsDialog
          onClose={() => setCreating(false)}
          onCreate={(name, format, from) => {
            const set = rankings.actions.create(name, format, from);
            setCreating(false);
            setEditing(set.id);
          }}
        />
      )}

      {editingSet && (
        <RankingEditor
          set={editingSet}
          players={PLAYERS}
          canUndo={rankings.canUndo}
          saving={rankings.saving}
          onChange={(next) => rankings.actions.update(next)}
          onRename={(name) => rankings.actions.rename(editingSet, name)}
          onUndo={rankings.actions.undo}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
