"use client";

import { SKILL_POSITIONS, type NflTeam, type Player, type SkillPosition } from "@/types";
import type { RankingBook } from "@/lib/rankings/book";
import { POSITION_ACCENT } from "@/lib/presentation";
import { Panel, PanelBody, PanelHeader } from "@/components/layout/Panel";
import { stackSignals } from "@/lib/draft/stacks";
import { PlayerRow } from "./PlayerRow";

interface PositionColumnsProps {
  players: readonly Player[];
  book: RankingBook;
  favorites: ReadonlySet<string>;
  myTeams: Map<NflTeam, Player[]>;
  onDraft: (player: Player) => void;
  onFavorite: (player: Player) => void;
}

const LABEL: Record<SkillPosition, string> = {
  QB: "Quarterbacks",
  RB: "Running backs",
  WR: "Wide receivers",
  TE: "Tight ends",
};

/**
 * Best available at each position, in the guide's positional order. This is the
 * home for everyone the guide ranks past the top 150 — they never appear on the
 * overall board because the guide gives them no overall rank.
 *
 * Each column shows a fixed slice rather than the whole pool. Grid stretch
 * equalises the panel heights, so a position carrying more tier breaks no
 * longer runs longer than one carrying fewer — the shorter columns simply end
 * in white space instead. Anyone past the slice is a search away on the left,
 * and the header count says how many that is.
 */
const DEPTH = 20;

export function PositionColumns({
  players,
  book,
  favorites,
  myTeams,
  onDraft,
  onFavorite,
}: PositionColumnsProps) {
  return (
    <div className="grid min-h-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {SKILL_POSITIONS.map((position) => {
        const remaining = players
          .filter((player) => player.position === position && book.entry(player.id))
          .sort(
            (a, b) =>
              (book.entry(a.id)?.position ?? 0) - (book.entry(b.id)?.position ?? 0),
          );
        // The header keeps the true remaining count; the list shows a slice.
        const pool = remaining.slice(0, DEPTH);
        return (
          <Panel key={position} className="min-h-0">
            <PanelHeader
              title={LABEL[position]}
              count={remaining.length}
              accent={POSITION_ACCENT[position]}
            />
            <PanelBody scroll={false}>
              {pool.length === 0 ? (
                <p className="px-2 py-6 text-center text-2xs text-dim">All gone.</p>
              ) : (
                pool.map((player, index) => {
                  const tier = book.entry(player.id)?.tier;
                  const previous = pool[index - 1];
                  const newTier =
                    index > 0 && tier !== (previous ? book.entry(previous.id)?.tier : undefined);

                  return (
                    <div key={player.id}>
                      {newTier && (
                        // The guide draws these breaks itself — the sharpest
                        // signal on the page, so they stay visible.
                        <div className="flex items-center gap-1.5 px-2 py-0.5">
                          <span className="tnum text-2xs text-dim">
                            {book.entry(player.id)?.tierName ?? `Tier ${tier}`}
                          </span>
                          <span className="h-px flex-1 bg-line" />
                        </div>
                      )}
                      <PlayerRow
                        player={player}
                        rank={book.entry(player.id)}
                        variant="compact"
                        signals={stackSignals(player, myTeams)}
                        isFavorite={favorites.has(player.id)}
                        onDraft={onDraft}
                        onFavorite={onFavorite}
                      />
                    </div>
                  );
                })
              )}
            </PanelBody>
          </Panel>
        );
      })}
    </div>
  );
}
