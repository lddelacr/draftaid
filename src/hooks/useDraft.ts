"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import {
  type DraftState,
  type LeagueSettings,
  type PlayerId,
  teamSlot,
} from "@/types";
import { DEFAULT_LINEUP } from "@/lib/scoring/formats";
import { createDraft, draftReducer, type DraftAction } from "@/lib/draft/reducer";
import { PLAYERS } from "@/lib/data/players";

const STORAGE_KEY = "draftaid:v1";

export const DEFAULT_SETTINGS: LeagueSettings = {
  teamCount: 12,
  rounds: 15,
  mySlot: teamSlot(1),
  format: "ppr",
  lineup: DEFAULT_LINEUP,
};

/** Guards against a stale or hand-edited payload in localStorage. */
function revive(raw: string): DraftState | null {
  try {
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed?.settings || !Array.isArray(parsed.picks)) return null;
    const known = new Set(PLAYERS.map((player) => player.id));
    return {
      ...parsed,
      settings: {
        ...parsed.settings,
        // A draft saved before a lineup slot existed has no value for it, and
        // undefined + 1 is NaN. Defaults fill any gap.
        lineup: { ...DEFAULT_LINEUP, ...parsed.settings.lineup },
      },
      picks: parsed.picks.filter((pick) => known.has(pick.playerId)),
      favorites: (parsed.favorites ?? []).filter((id) => known.has(id)),
      queue: (parsed.queue ?? []).filter((id) => known.has(id)),
    };
  } catch {
    return null;
  }
}

/**
 * Draft state, persisted on every change. A draft that vanishes on refresh is
 * worse than no draft tool at all, and the reference implementation never got
 * this far — it is still an open TODO in its README.
 */
export function useDraft() {
  const [state, dispatch] = useReducer(draftReducer, DEFAULT_SETTINGS, createDraft);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    const revived = stored ? revive(stored) : null;
    if (revived) {
      dispatch({ type: "settings", settings: revived.settings });
      for (const pick of revived.picks) {
        dispatch({ type: "draft", playerId: pick.playerId });
      }
      for (const id of revived.favorites) dispatch({ type: "favorite", playerId: id });
      for (const id of revived.queue) dispatch({ type: "queue", playerId: id });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const actions = useMemo(
    () => ({
      draft: (playerId: PlayerId) => dispatch({ type: "draft", playerId }),
      undo: () => dispatch({ type: "undo" }),
      reset: () => dispatch({ type: "reset" }),
      favorite: (playerId: PlayerId) => dispatch({ type: "favorite", playerId }),
      enqueue: (playerId: PlayerId) => dispatch({ type: "queue", playerId }),
      dequeue: (playerId: PlayerId) => dispatch({ type: "unqueue", playerId }),
      updateSettings: (settings: LeagueSettings) =>
        dispatch({ type: "settings", settings }),
      raw: (action: DraftAction) => dispatch(action),
    }),
    [],
  );

  return { state, actions, hydrated };
}

/** Keyboard map. Ignores keystrokes aimed at an input. */
export function useHotkeys(map: Record<string, (event: KeyboardEvent) => void>) {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      const combo = [
        event.metaKey || event.ctrlKey ? "mod" : null,
        event.shiftKey ? "shift" : null,
        event.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join("+");

      const action = map[combo];
      if (!action) return;
      // Modified shortcuts still fire while typing; bare letters do not.
      if (typing && !combo.startsWith("mod") && event.key !== "Escape") return;
      event.preventDefault();
      action(event);
    },
    [map],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
