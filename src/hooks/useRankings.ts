"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Player, RankingSet, RankingSource, ScoringFormat } from "@/types";
import { PLAYERS } from "@/lib/data/players";
import { resolveBook } from "@/lib/rankings/book";
import * as ops from "@/lib/rankings/sets";
import { EMPTY_STORE, loadRankings, saveRankings, type RankingStore } from "@/lib/rankings/storage";

/**
 * Ranking state, kept entirely separate from draft state.
 *
 * The two persist under different keys and share no reducer, which is what
 * guarantees that switching sets cannot disturb picks, seats or rosters — there
 * is no code path from one to the other.
 */
export function useRankings(players: readonly Player[] = PLAYERS) {
  const [store, setStore] = useState<RankingStore>(EMPTY_STORE);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Past versions of the set being edited, newest last.
   *
   * The depth is mirrored into state because the editor's undo button reads it
   * during render — a ref alone would leave the button greyed out after the
   * first edit until something else forced a re-render.
   */
  const undoStack = useRef<RankingSet[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);

  useEffect(() => {
    setStore(loadRankings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveRankings(store);
  }, [store, hydrated]);

  const book = useMemo(
    () => resolveBook(store.active, store.sets, players),
    [store.active, store.sets, players],
  );

  const activeSet = useMemo(() => {
    const active = store.active;
    if (active.kind !== "custom") return null;
    return store.sets.find((set) => set.id === active.setId) ?? null;
  }, [store.active, store.sets]);

  const replaceSet = useCallback((next: RankingSet, recordUndo = true) => {
    setStore((current) => {
      const previous = current.sets.find((set) => set.id === next.id);
      if (recordUndo && previous) {
        undoStack.current = [...undoStack.current.slice(-49), previous];
        setUndoDepth(undoStack.current.length);
      }
      return {
        ...current,
        sets: current.sets.map((set) => (set.id === next.id ? next : set)),
      };
    });
  }, []);

  const actions = useMemo(
    () => ({
      /** Switch what the board evaluates against. Never touches the draft. */
      activate: (active: RankingSource) =>
        setStore((current) => ({ ...current, active })),

      create: (name: string, format: ScoringFormat, from: "default" | "blank") => {
        const set =
          from === "default"
            ? ops.fromDefault(name, format, players, store.sets)
            : ops.blank(name, format, store.sets);
        setStore((current) => ({
          ...current,
          sets: [...current.sets, set],
          active: { kind: "custom", setId: set.id },
        }));
        undoStack.current = [];
        setUndoDepth(0);
        return set;
      },

      duplicate: (set: RankingSet) => {
        const copy = ops.duplicate(set, store.sets);
        setStore((current) => ({ ...current, sets: [...current.sets, copy] }));
        return copy;
      },

      rename: (set: RankingSet, name: string) =>
        replaceSet(ops.rename(set, name, store.sets), false),

      remove: (id: string) =>
        setStore((current) => {
          const sets = current.sets.filter((set) => set.id !== id);
          // Deleting the active set falls back to the guide rather than
          // leaving the board pointed at nothing.
          const stillActive =
            current.active.kind === "custom" && current.active.setId === id;
          return { ...current, sets, active: stillActive ? EMPTY_STORE.active : current.active };
        }),

      update: replaceSet,

      undo: () => {
        const previous = undoStack.current.at(-1);
        if (!previous) return;
        undoStack.current = undoStack.current.slice(0, -1);
        setUndoDepth(undoStack.current.length);
        replaceSet(previous, false);
      },
    }),
    [players, replaceSet, store.sets],
  );

  return {
    store,
    sets: store.sets,
    active: store.active,
    activeSet,
    book,
    actions,
    canUndo: undoDepth > 0,
    hydrated,
  };
}
