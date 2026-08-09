"use client";

import { Minus, Plus } from "lucide-react";
import type { DraftState, LineupSlots, Player, Position } from "@/types";
import { cn } from "@/lib/utils";
import { myRoster } from "@/lib/draft/selectors";
import { fillLineup } from "@/lib/scoring/lineup";
import { POSITION_STYLES } from "@/lib/presentation";
import { Panel, PanelBody, PanelHeader } from "@/components/layout/Panel";

const EDITABLE: { key: keyof LineupSlots; label: string }[] = [
  { key: "QB", label: "QB" },
  { key: "RB", label: "RB" },
  { key: "WR", label: "WR" },
  { key: "TE", label: "TE" },
  { key: "FLEX", label: "FLEX" },
  { key: "SUPERFLEX", label: "SFLX" },
  { key: "BENCH", label: "BN" },
];

/**
 * My team as a lineup card rather than a pick list. Empty slots are the point:
 * "what am I still missing" should be readable at a glance, not counted.
 */
export function LineupCard({
  state,
  players,
  onLineup,
}: {
  state: DraftState;
  players: readonly Player[];
  onLineup: (lineup: LineupSlots) => void;
}) {
  const roster = myRoster(state, players);
  const { starters, bench } = fillLineup(roster, state.settings.lineup);

  const byeCounts = new Map<number, number>();
  for (const slot of starters) {
    if (slot.player?.byeWeek) {
      byeCounts.set(slot.player.byeWeek, (byeCounts.get(slot.player.byeWeek) ?? 0) + 1);
    }
  }

  const adjust = (key: keyof LineupSlots, delta: number) =>
    onLineup({
      ...state.settings.lineup,
      [key]: Math.max(0, Math.min(9, state.settings.lineup[key] + delta)),
    });

  return (
    <Panel className="shrink-0">
      <PanelHeader title="My team" count={roster.length} />

      <div className="space-y-px px-1 pb-1">
        {starters.map((slot) => {
          const clash = slot.player?.byeWeek
            ? (byeCounts.get(slot.player.byeWeek) ?? 0) >= 3
            : false;

          return (
            <div
              key={slot.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-1.5 py-1",
                slot.player ? "bg-transparent" : "bg-sunken/60",
              )}
            >
              <span
                className={cn(
                  "tnum w-11 shrink-0 rounded px-1 py-px text-center text-2xs font-medium",
                  slot.kind === "FLEX" || slot.kind === "SUPERFLEX"
                    ? "bg-sunken text-muted"
                    : POSITION_STYLES[slot.kind as Position],
                )}
              >
                {slot.label}
              </span>

              {slot.player ? (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-body">
                    {slot.player.name}
                  </span>
                  <span className="tnum text-2xs text-muted">{slot.player.team ?? "—"}</span>
                  <span
                    title={clash ? "Three or more starters share this bye" : undefined}
                    className={cn("tnum w-6 text-right text-2xs", clash ? "text-pass" : "text-dim")}
                  >
                    {slot.player.byeWeek ?? "—"}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-sm text-dim">Empty</span>
              )}
            </div>
          );
        })}

        {bench.length > 0 && (
          <div className="mt-1 border-t border-line pt-1">
            <p className="px-1.5 pb-0.5 text-2xs uppercase tracking-wide text-dim">
              Bench · {bench.length}
            </p>
            {bench.map((player) => (
              <div key={player.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
                <span
                  className={cn(
                    "tnum w-11 shrink-0 rounded px-1 py-px text-center text-2xs",
                    POSITION_STYLES[player.position],
                  )}
                >
                  {player.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{player.name}</span>
                <span className="tnum w-6 text-right text-2xs text-dim">
                  {player.byeWeek ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="border-t border-line">
        <summary className="cursor-pointer px-2.5 py-1.5 text-2xs uppercase tracking-wide text-dim hover:text-body">
          Roster slots
        </summary>
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          {EDITABLE.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1 rounded-md bg-sunken px-1.5 py-1">
              <span className="flex-1 text-2xs text-muted">{label}</span>
              <Stepper onClick={() => adjust(key, -1)} label={`One fewer ${label}`}>
                <Minus className="size-3" />
              </Stepper>
              <span className="tnum w-3 text-center text-2xs text-body">
                {state.settings.lineup[key]}
              </span>
              <Stepper onClick={() => adjust(key, 1)} label={`One more ${label}`}>
                <Plus className="size-3" />
              </Stepper>
            </div>
          ))}
        </div>
      </details>
    </Panel>
  );
}

function Stepper({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded p-0.5 text-dim transition-colors hover:bg-panel hover:text-body"
    >
      {children}
    </button>
  );
}

/**
 * Drafted players, newest first, each with how far they went against the
 * guide's rank: positive means they lasted past it, negative means a reach.
 */
export function DraftHistory({
  state,
  players,
}: {
  state: DraftState;
  players: readonly Player[];
}) {
  const index = new Map(players.map((player) => [player.id, player]));
  const format = state.settings.format;

  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title="Drafted" count={state.picks.length} />
      <div className="flex items-center gap-2 border-b border-line px-2 py-1 text-2xs uppercase tracking-wide text-dim">
        <span className="w-9">Pick</span>
        <span className="flex-1">Player</span>
        <span title="Picks past your rank — positive is value, negative is a reach">
          vs rank
        </span>
      </div>

      <PanelBody>
        {state.picks.length === 0 ? (
          <p className="px-2 py-6 text-sm text-dim">No picks yet.</p>
        ) : (
          <ul className="space-y-px">
            {[...state.picks].reverse().map((pick) => {
              const player = index.get(pick.playerId);
              const mine = pick.slot === state.settings.mySlot;
              const inRound = ((pick.pick - 1) % state.settings.teamCount) + 1;
              const rank = player?.ranks[format]?.overall;
              const delta = rank === undefined ? null : pick.pick - rank;

              return (
                <li
                  key={pick.pick}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1",
                    mine && "bg-accent/10",
                  )}
                >
                  <span className="tnum w-9 shrink-0 text-2xs text-dim">
                    {pick.round}.{String(inRound).padStart(2, "0")}
                  </span>
                  {player && (
                    <span
                      className={cn(
                        "tnum w-7 shrink-0 rounded px-1 py-px text-center text-2xs",
                        POSITION_STYLES[player.position],
                      )}
                    >
                      {player.position}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-body">
                    {player?.name ?? "—"}
                    {mine && <span className="ml-1 text-2xs text-accent">you</span>}
                  </span>
                  <span
                    title={
                      delta === null
                        ? "Outside your top 150"
                        : delta >= 0
                          ? `Lasted ${delta} picks past your rank of ${rank}`
                          : `Went ${-delta} picks ahead of your rank of ${rank}`
                    }
                    className={cn(
                      "tnum w-8 shrink-0 text-right text-2xs",
                      delta === null
                        ? "text-dim"
                        : delta > 0
                          ? "text-target"
                          : delta < 0
                            ? "text-avoid"
                            : "text-dim",
                    )}
                  >
                    {delta === null ? "—" : delta > 0 ? `+${delta}` : delta}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
