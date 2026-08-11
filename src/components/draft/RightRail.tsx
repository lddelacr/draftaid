"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, X } from "lucide-react";
import { type DraftState, type LineupSlots, type Player, type PlayerId, type Position, teamSlot } from "@/types";
import { cn } from "@/lib/utils";
import { rosters } from "@/lib/draft/selectors";
import { fillLineup } from "@/lib/scoring/lineup";
import { POSITION_STYLES } from "@/lib/presentation";
import { Panel, PanelBody, PanelHeader } from "@/components/layout/Panel";

const EDITABLE: { key: keyof LineupSlots; label: string }[] = [
  { key: "QB", label: "QB" },
  { key: "RB", label: "RB" },
  { key: "WR", label: "WR" },
  { key: "TE", label: "TE" },
  { key: "FLEX", label: "FLEX" },
  { key: "K", label: "K" },
  { key: "DST", label: "DST" },
  { key: "SUPERFLEX", label: "SFLX" },
  { key: "BENCH", label: "BN" },
];

/**
 * A lineup card rather than a pick list. Empty slots are the point: "what am I
 * still missing" should be readable at a glance, not counted.
 *
 * The seat arrows walk the same card across every team in the league, which
 * doubles as the scouting view — seeing that the seat picking ahead of you has
 * two backs and no receivers is worth more than a roster dump.
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
  const [viewSlot, setViewSlot] = useState<number>(state.settings.mySlot);
  const { teamCount, mySlot, format } = state.settings;

  // Follow the user's seat if they change it in the header.
  const slot = Math.min(viewSlot, teamCount);
  const mine = slot === mySlot;

  const roster = rosters(state, players).get(teamSlot(slot)) ?? [];
  const { starters, bench } = fillLineup(roster, state.settings.lineup);

  /** Pick number each player went at, for the value column. */
  const pickOf = new Map(state.picks.map((pick) => [pick.playerId, pick.pick]));
  const deltaOf = (player: Player): number | null => {
    const rank = player.ranks[format]?.overall;
    const pick = pickOf.get(player.id);
    return rank === undefined || pick === undefined ? null : pick - rank;
  };
  const net = roster.reduce(
    (total: number, player: Player) => total + (deltaOf(player) ?? 0),
    0,
  );

  /** Net value per seat, so the dropdown doubles as a league-wide scoreboard. */
  const allRosters = rosters(state, players);
  const netBySlot = new Map<number, number>();
  for (const [seat, seatRoster] of allRosters) {
    netBySlot.set(
      seat,
      seatRoster.reduce((total: number, player: Player) => total + (deltaOf(player) ?? 0), 0),
    );
  }

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
      <PanelHeader title="Team" count={roster.length}>
        <span
          title="Net picks past rank across this roster — positive is value, negative is reaching"
          className={cn(
            "tnum rounded px-1 text-2xs",
            net > 0 ? "text-target" : net < 0 ? "text-avoid" : "text-dim",
          )}
        >
          {net > 0 ? `+${net}` : net}
        </span>
        <select
          value={slot}
          onChange={(event) => setViewSlot(Number(event.target.value))}
          aria-label="Which team to view"
          className="rounded-md border border-line bg-sunken px-1 py-0.5 text-2xs text-body hover:border-line-strong"
        >
          {Array.from({ length: teamCount }, (_, index) => index + 1).map((seat) => {
            const value = netBySlot.get(seat) ?? 0;
            const label = seat === mySlot ? "Me" : `Team ${seat}`;
            return (
              <option key={seat} value={seat}>
                {label} ({value > 0 ? `+${value}` : value})
              </option>
            );
          })}
        </select>
      </PanelHeader>

      <div className="flex items-center gap-2 border-b border-line px-2.5 py-1 text-2xs uppercase tracking-wide text-dim">
        <span className="w-11">Slot</span>
        <span className="flex-1">Player</span>
        <span className="w-8 text-right">vs rk</span>
        <span className="w-7 text-right">Team</span>
        <span className="w-6 text-right">Bye</span>
      </div>

      <div className="space-y-px px-1 pb-1 pt-1">
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
                  <Delta value={deltaOf(slot.player)} />
                  <span className="tnum w-7 text-right text-2xs text-muted">
                    {slot.player.team ?? "—"}
                  </span>
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
                <Delta value={deltaOf(player)} />
                <span className="tnum w-7 text-right text-2xs text-muted">
                  {player.team ?? "—"}
                </span>
                <span className="tnum w-6 text-right text-2xs text-dim">
                  {player.byeWeek ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {mine && (
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
      )}
    </Panel>
  );
}

/** Picks past rank: positive lasted, negative was a reach. */
function Delta({ value }: { value: number | null }) {
  return (
    <span
      className={cn(
        "tnum w-8 shrink-0 text-right text-2xs",
        value === null ? "text-dim" : value > 0 ? "text-target" : value < 0 ? "text-avoid" : "text-dim",
      )}
    >
      {value === null ? "—" : value > 0 ? `+${value}` : value}
    </span>
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

type Sort = "order" | "value" | "reach";

/**
 * Drafted players with how far each went against the guide's rank: positive
 * means they lasted past it, negative means someone reached.
 *
 * Clicking a row removes that pick and shifts everyone after it up, which is
 * the only practical fix once a mis-entered pick is buried ten picks deep —
 * undo alone would mean unwinding every correct pick on top of it.
 */
export function DraftHistory({
  state,
  players,
  onRemove,
}: {
  state: DraftState;
  players: readonly Player[];
  onRemove: (playerId: PlayerId) => void;
}) {
  const [sort, setSort] = useState<Sort>("order");
  const index = new Map(players.map((player) => [player.id, player]));
  const format = state.settings.format;

  const deltaOf = (pick: (typeof state.picks)[number]): number | null => {
    const rank = index.get(pick.playerId)?.ranks[format]?.overall;
    return rank === undefined ? null : pick.pick - rank;
  };

  const ordered = [...state.picks];
  if (sort === "order") {
    ordered.reverse();
  } else {
    // Unranked picks have no delta to compare, so they sink to the bottom.
    const direction = sort === "value" ? -1 : 1;
    ordered.sort((a, b) => {
      const left = deltaOf(a);
      const right = deltaOf(b);
      if (left === null) return 1;
      if (right === null) return -1;
      return (left - right) * direction;
    });
  }

  return (
    <Panel className="min-h-0 flex-1">
      <PanelHeader title="Drafted" count={state.picks.length} />
      <div className="flex items-center gap-2 border-b border-line px-2 py-1 text-2xs uppercase tracking-wide text-dim">
        <button
          type="button"
          onClick={() => setSort("order")}
          className={cn("w-9 text-left transition-colors hover:text-body", sort === "order" && "text-body")}
        >
          Pick
        </button>
        <span className="flex-1">Player</span>
        <button
          type="button"
          title="Sort by value: best steals first, then click again for the worst reaches"
          onClick={() => setSort(sort === "value" ? "reach" : "value")}
          className={cn(
            "flex items-center gap-0.5 uppercase transition-colors hover:text-body",
            sort !== "order" && "text-body",
          )}
        >
          vs rank
          {sort === "value" && <ArrowDown className="size-2.5" />}
          {sort === "reach" && <ArrowUp className="size-2.5" />}
        </button>
      </div>

      <PanelBody>
        {state.picks.length === 0 ? (
          <p className="px-2 py-6 text-sm text-dim">No picks yet.</p>
        ) : (
          <ul className="space-y-px">
            {ordered.map((pick) => {
              const player = index.get(pick.playerId);
              const mine = pick.slot === state.settings.mySlot;
              const inRound = ((pick.pick - 1) % state.settings.teamCount) + 1;
              const rank = player?.ranks[format]?.overall;
              const delta = deltaOf(pick);

              return (
                <li key={pick.pick}>
                <button
                  type="button"
                  onClick={() => onRemove(pick.playerId)}
                  title={`Remove ${player?.name ?? "this pick"} and shift later picks up`}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left",
                    "hover:bg-avoid/10",
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
                  <X className="size-3 shrink-0 text-avoid opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                </li>
              );
            })}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}
