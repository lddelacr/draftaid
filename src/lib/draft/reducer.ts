import {
  type DraftState,
  type LeagueSettings,
  type Pick,
  type PlayerId,
  pickNumber,
} from "@/types";
import { roundOf, slotOnClock, totalPicks } from "./snake";

/**
 * The whole draft is a list of picks in order. Nothing about a pick's seat or
 * round is stored — it is derived from its index — so undo is a pop and redo
 * is a push. No mutation, which is where the reference implementation's search
 * and draft views drifted out of sync.
 */

export type DraftAction =
  | { type: "draft"; playerId: PlayerId }
  | { type: "remove"; playerId: PlayerId }
  | { type: "undo" }
  | { type: "reset" }
  | { type: "settings"; settings: LeagueSettings }
  | { type: "favorite"; playerId: PlayerId }
  | { type: "queue"; playerId: PlayerId }
  | { type: "unqueue"; playerId: PlayerId }
  | { type: "reorderQueue"; from: number; to: number };

export function createDraft(settings: LeagueSettings): DraftState {
  return { settings, picks: [], favorites: [], queue: [] };
}

const toggle = (list: readonly PlayerId[], id: PlayerId): PlayerId[] =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

/**
 * Re-derives pick number, seat and round from list position. Removing a pick
 * from the middle shifts everyone after it up a slot, which is exactly right
 * when you are correcting a pick that never happened.
 */
function renumber(picks: readonly Pick[], settings: LeagueSettings): Pick[] {
  return picks.map((entry, index) => {
    const pick = pickNumber(index + 1);
    return {
      ...entry,
      pick,
      slot: slotOnClock(pick, settings.teamCount),
      round: roundOf(pick, settings.teamCount),
    };
  });
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const item = next[from];
  if (from === to || item === undefined) return next;
  next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "draft": {
      const { settings, picks } = state;
      const alreadyGone = picks.some((pick) => pick.playerId === action.playerId);
      if (alreadyGone || picks.length >= totalPicks(settings)) return state;

      const pick = pickNumber(picks.length + 1);
      const next: Pick = {
        pick,
        slot: slotOnClock(pick, settings.teamCount),
        round: roundOf(pick, settings.teamCount),
        playerId: action.playerId,
      };
      return {
        ...state,
        picks: [...picks, next],
        // Drafting a queued player removes them from the shortlist.
        queue: state.queue.filter((id) => id !== action.playerId),
      };
    }

    case "remove": {
      const remaining = state.picks.filter((pick) => pick.playerId !== action.playerId);
      return remaining.length === state.picks.length
        ? state
        : { ...state, picks: renumber(remaining, state.settings) };
    }

    case "undo":
      return state.picks.length === 0
        ? state
        : { ...state, picks: state.picks.slice(0, -1) };

    case "reset":
      return { ...state, picks: [] };

    case "settings": {
      // Changing league shape mid-draft would re-attribute existing picks to
      // the wrong seats, so the board is cleared with the change.
      const shapeChanged =
        action.settings.teamCount !== state.settings.teamCount ||
        action.settings.rounds !== state.settings.rounds;
      return {
        ...state,
        settings: action.settings,
        picks: shapeChanged ? [] : state.picks,
      };
    }

    case "favorite":
      return { ...state, favorites: toggle(state.favorites, action.playerId) };

    case "queue":
      return state.queue.includes(action.playerId)
        ? state
        : { ...state, queue: [...state.queue, action.playerId] };

    case "unqueue":
      return {
        ...state,
        queue: state.queue.filter((id) => id !== action.playerId),
      };

    case "reorderQueue":
      return { ...state, queue: move(state.queue, action.from, action.to) };
  }
}
