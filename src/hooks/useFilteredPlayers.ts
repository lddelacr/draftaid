"use client";

import { useMemo } from "react";
import type { Player } from "@/types";

export interface BoardFilters {
  readonly query: string;
  readonly favoritesOnly: boolean;
}

export const EMPTY_FILTERS: BoardFilters = { query: "", favoritesOnly: false };

/**
 * Matches on initials and subsequences as well as substrings, so "jsn" finds
 * Jaxon Smith-Njigba and "cmc" finds Christian McCaffrey. During a live draft
 * you type three characters, not a surname.
 */
export function matches(player: Player, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const name = player.name.toLowerCase();
  if (name.includes(needle)) return true;
  if (player.team?.toLowerCase() === needle) return true;

  const initials = player.name
    .split(/[\s.'-]+/)
    .map((part) => part[0]?.toLowerCase() ?? "")
    .join("");
  if (initials.startsWith(needle)) return true;

  let cursor = 0;
  for (const character of name) {
    if (character === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return false;
}

export function useFilteredPlayers(
  players: readonly Player[],
  filters: BoardFilters,
  favorites: readonly string[],
): Player[] {
  return useMemo(() => {
    const starred = new Set(favorites);
    return players.filter((player) => {
      if (filters.favoritesOnly && !starred.has(player.id)) return false;
      return matches(player, filters.query);
    });
  }, [players, filters, favorites]);
}
