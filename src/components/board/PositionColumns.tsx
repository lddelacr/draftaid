"use client";

import { POSITIONS, type NflTeam, type Player, type Position, type ScoringFormat } from "@/types";
import { POSITION_ACCENT } from "@/lib/presentation";
import { Panel, PanelBody, PanelHeader } from "@/components/layout/Panel";
import { stackSignals } from "@/lib/draft/stacks";
import { PlayerRow } from "./PlayerRow";

interface PositionColumnsProps {
  players: readonly Player[];
  format: ScoringFormat;
  favorites: ReadonlySet<string>;
  myTeams: Map<NflTeam, Player[]>;
  onDraft: (player: Player) => void;
  onFavorite: (player: Player) => void;
}

const LABEL: Record<Position, string> = {
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
 * Columns fill the viewport and scroll independently rather than showing a
 * fixed number of players. A fixed count looked ragged because tier dividers
 * are rows too, so a position with more tier breaks ran longer than one with
 * fewer even at identical depth.
 */
export function PositionColumns({
  players,
  format,
  favorites,
  myTeams,
  onDraft,
  onFavorite,
}: PositionColumnsProps) {
  return (
    <div className="grid min-h-0 grid-cols-1 gap-2 sm:h-full sm:grid-cols-2 xl:grid-cols-4">
      {POSITIONS.map((position) => {
        const pool = players
          .filter((player) => player.position === position && player.ranks[format])
          .sort(
            (a, b) =>
              (a.ranks[format]?.position ?? 0) - (b.ranks[format]?.position ?? 0),
          );
        return (
          <Panel key={position} className="min-h-0">
            <PanelHeader
              title={LABEL[position]}
              count={pool.length}
              accent={POSITION_ACCENT[position]}
            />
            <PanelBody>
              {pool.length === 0 ? (
                <p className="px-2 py-6 text-center text-2xs text-dim">All gone.</p>
              ) : (
                pool.map((player, index) => {
                  const tier = player.ranks[format]?.tier;
                  const newTier = index > 0 && tier !== pool[index - 1]?.ranks[format]?.tier;

                  return (
                    <div key={player.id}>
                      {newTier && (
                        // The guide draws these breaks itself — the sharpest
                        // signal on the page, so they stay visible.
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span className="tnum text-2xs text-dim">Tier {tier}</span>
                          <span className="h-px flex-1 bg-line" />
                        </div>
                      )}
                      <PlayerRow
                        player={player}
                        format={format}
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
