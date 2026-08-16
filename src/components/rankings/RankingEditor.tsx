"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Scissors, Search, Undo2, X } from "lucide-react";
import {
  SKILL_POSITIONS,
  type Player,
  type PlayerId,
  type RankingSet,
  type Sentiment,
  type SkillPosition,
} from "@/types";
import { cn } from "@/lib/utils";
import { POSITION_STYLES, SENTIMENT_TAG, SENTIMENT_WORD } from "@/lib/presentation";
import { matches } from "@/hooks/useFilteredPlayers";
import * as ops from "@/lib/rankings/sets";

/**
 * The ranking editor.
 *
 * Built around one interaction — moving a player — because that is what draft
 * prep actually is. Drag handles use native HTML5 drag events rather than a
 * library: the list is a single flat column of homogeneous rows, which is the
 * case native DnD handles well, and a drag library would have been the largest
 * dependency in the project for one screen.
 *
 * Every edit routes through the pure operations in lib/rankings/sets, so the
 * component holds no ranking logic and undo is just replaying a previous set.
 */

interface RankingEditorProps {
  set: RankingSet;
  players: readonly Player[];
  canUndo: boolean;
  onChange: (set: RankingSet) => void;
  onRename: (name: string) => void;
  onUndo: () => void;
  onClose: () => void;
}

export function RankingEditor({
  set,
  players,
  canUndo,
  onChange,
  onRename,
  onUndo,
  onClose,
}: RankingEditorProps) {
  const [query, setQuery] = useState("");
  const [positions, setPositions] = useState<SkillPosition[]>([]);
  const [selected, setSelected] = useState<PlayerId | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const byId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  /** Rows carry their true index so filtering never corrupts a move. */
  const rows = useMemo(
    () =>
      set.entries.flatMap((entry, index) => {
        const player = byId.get(entry.playerId);
        if (!player) return [];
        if (positions.length && !positions.includes(player.position as SkillPosition)) return [];
        if (!matches(player, query)) return [];
        return [{ entry, player, index }];
      }),
    [set.entries, byId, positions, query],
  );

  const filtering = query.length > 0 || positions.length > 0;
  const missing = useMemo(() => ops.missingFrom(set, players), [set, players]);

  const commit = (next: RankingSet) => onChange(next);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= set.entries.length) return;
    commit(ops.moveEntry(set, from, to));
  };

  const cycleSentiment = (playerId: PlayerId, current: Sentiment) => {
    const order: Sentiment[] = ["neutral", "target", "pass", "avoid"];
    const next = order[(order.indexOf(current) + 1) % order.length] ?? "neutral";
    commit(ops.setSentiment(set, playerId, next));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
        <input
          value={set.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Ranking set name"
          className="min-w-0 max-w-xs flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-body hover:border-line focus:border-accent/40 focus:bg-sunken"
        />
        <span className="tnum text-2xs text-dim">{set.entries.length} players</span>

        <span className="ml-auto flex items-center gap-1">
          <span className="mr-1 hidden text-2xs text-dim sm:inline">
            Saves as you edit
          </span>
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last change"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-body disabled:pointer-events-none disabled:opacity-30"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-2xs font-medium text-accent-ink"
          >
            Done
          </button>
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <label className="relative flex min-w-[12rem] flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player"
            className="w-full rounded-md border border-line bg-sunken py-1.5 pl-8 pr-2 text-sm text-body placeholder:text-dim focus:border-accent/40"
          />
        </label>

        <div className="flex items-center gap-1">
          {SKILL_POSITIONS.map((position) => {
            const active = positions.includes(position);
            return (
              <button
                key={position}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setPositions((current) =>
                    current.includes(position)
                      ? current.filter((entry) => entry !== position)
                      : [...current, position],
                  )
                }
                className={cn(
                  "tnum rounded px-1.5 py-0.5 text-2xs font-medium transition-opacity",
                  POSITION_STYLES[position],
                  !active && "opacity-45 hover:opacity-80",
                )}
              >
                {position}
              </button>
            );
          })}
        </div>

        {filtering && (
          <span className="text-2xs text-pass">
            Filtered — drag is disabled until you clear it
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {set.entries.length === 0 ? (
          <EmptySet missing={missing} onAdd={(id) => commit(ops.addPlayer(set, id))} />
        ) : rows.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-dim">
            Nobody matches that.
          </p>
        ) : (
          rows.map(({ entry, player, index }, position) => {
            const previous = rows[position - 1];
            const startsTier = position === 0 || previous?.entry.tier !== entry.tier;
            const isSelected = selected === player.id;

            return (
              <div key={player.id}>
                {startsTier && (
                  <TierHeading
                    tier={entry.tier}
                    label={set.tierNames[entry.tier]}
                    onRename={(label) => commit(ops.nameTier(set, entry.tier, label))}
                    onMerge={
                      entry.tier > 1
                        ? () => commit(ops.mergeTierUp(set, entry.tier))
                        : undefined
                    }
                  />
                )}

                <div
                  draggable={!filtering}
                  onDragStart={() => {
                    dragFrom.current = index;
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(index);
                  }}
                  onDragEnd={() => {
                    dragFrom.current = null;
                    setDragOver(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = dragFrom.current;
                    if (from !== null) move(from, index);
                    dragFrom.current = null;
                    setDragOver(null);
                  }}
                  onClick={() => setSelected(player.id)}
                  onKeyDown={(event) => {
                    if (event.altKey && event.key === "ArrowUp") {
                      event.preventDefault();
                      move(index, index - 1);
                    } else if (event.altKey && event.key === "ArrowDown") {
                      event.preventDefault();
                      move(index, index + 1);
                    } else if (event.key === "t" || event.key === "p" || event.key === "a") {
                      event.preventDefault();
                      const map = { t: "target", p: "pass", a: "avoid" } as const;
                      const next = map[event.key];
                      commit(
                        ops.setSentiment(
                          set,
                          player.id,
                          entry.sentiment === next ? "neutral" : next,
                        ),
                      );
                    }
                  }}
                  tabIndex={0}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-1.5 py-1 outline-none transition-colors",
                    "hover:bg-sunken focus-visible:bg-sunken",
                    isSelected && "bg-accent/5",
                    dragOver === index && "ring-1 ring-accent",
                  )}
                >
                  <GripVertical
                    className={cn(
                      "size-3.5 shrink-0",
                      filtering ? "text-transparent" : "cursor-grab text-dim",
                    )}
                  />
                  <span className="tnum w-8 shrink-0 text-right text-2xs text-dim">
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "tnum w-8 shrink-0 rounded px-1 py-px text-center text-2xs font-medium",
                      POSITION_STYLES[player.position],
                    )}
                  >
                    {player.position}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-body">
                    {player.name}
                  </span>
                  <span className="tnum shrink-0 text-2xs text-muted">
                    {player.team ?? "—"}
                  </span>

                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        cycleSentiment(player.id, entry.sentiment);
                      }}
                      title="Cycle target / pass / avoid — or press T, P, A"
                      className={cn(
                        "w-14 rounded px-1 py-px text-2xs font-medium transition-colors",
                        entry.sentiment === "neutral"
                          ? "text-dim hover:bg-line hover:text-body"
                          : SENTIMENT_TAG[entry.sentiment],
                      )}
                    >
                      {entry.sentiment === "neutral" ? "—" : SENTIMENT_WORD[entry.sentiment]}
                    </button>

                    <IconAction
                      label="Move up (Alt+↑)"
                      disabled={filtering}
                      onClick={() => move(index, index - 1)}
                    >
                      <ChevronUp className="size-3" />
                    </IconAction>
                    <IconAction
                      label="Move down (Alt+↓)"
                      disabled={filtering}
                      onClick={() => move(index, index + 1)}
                    >
                      <ChevronDown className="size-3" />
                    </IconAction>
                    <IconAction
                      label="Start a new tier here"
                      disabled={index === 0}
                      onClick={() => commit(ops.splitTierAt(set, index))}
                    >
                      <Scissors className="size-3" />
                    </IconAction>
                  </span>
                </div>
              </div>
            );
          })
        )}

        {set.entries.length > 0 && missing.length > 0 && (
          <MissingPlayers
            missing={missing}
            onAdd={(id) => commit(ops.addPlayer(set, id))}
          />
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-line bg-panel px-3 py-1.5 text-2xs text-dim">
        <span>Drag to reorder</span>
        <span>Alt+↑ / Alt+↓ to nudge</span>
        <span>T / P / A to mark</span>
        <span className="ml-auto">Changes save automatically</span>
      </footer>
    </div>
  );
}

function TierHeading({
  tier,
  label,
  onRename,
  onMerge,
}: {
  tier: number;
  label?: string;
  onRename: (label: string) => void;
  onMerge?: () => void;
}) {
  return (
    <div className="group/tier mt-2 flex items-center gap-2 px-1.5 py-1">
      <span className="tnum text-2xs font-medium uppercase tracking-wide text-muted">
        Tier {tier}
      </span>
      <input
        value={label ?? ""}
        onChange={(event) => onRename(event.target.value)}
        placeholder="Name this tier"
        className="w-36 rounded border border-transparent bg-transparent px-1 text-2xs text-body placeholder:text-dim/60 hover:border-line focus:border-accent/40"
      />
      <span className="h-px flex-1 bg-line" />
      {onMerge && (
        <button
          type="button"
          onClick={onMerge}
          className="rounded px-1 text-2xs text-dim opacity-0 transition-opacity hover:text-body group-hover/tier:opacity-100"
        >
          Merge up
        </button>
      )}
    </div>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="rounded p-0.5 text-dim opacity-0 transition-opacity hover:bg-line hover:text-body group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}

function EmptySet({
  missing,
  onAdd,
}: {
  missing: readonly Player[];
  onAdd: (id: PlayerId) => void;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-10 text-center">
      <p className="text-sm text-body">This set is empty.</p>
      <p className="mt-1 text-2xs leading-relaxed text-dim">
        Add players one at a time below, or close this and create a set from the
        default guide instead — that clones all 250 in the guide&apos;s order and
        is far quicker to edit down.
      </p>
      <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-line">
        {missing.slice(0, 60).map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onAdd(player.id)}
            className="flex w-full items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-sunken"
          >
            <span
              className={cn(
                "tnum w-8 rounded px-1 text-center text-2xs",
                POSITION_STYLES[player.position],
              )}
            >
              {player.position}
            </span>
            <span className="flex-1 truncate text-sm text-body">{player.name}</span>
            <span className="text-2xs text-dim">Add</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Players in the dataset this set does not carry — normally because the set
 * predates a guide update. Surfaced rather than silently dropped so a stale set
 * can be brought current without rebuilding it.
 */
function MissingPlayers({
  missing,
  onAdd,
}: {
  missing: readonly Player[];
  onAdd: (id: PlayerId) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 rounded-lg border border-line">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-2xs uppercase tracking-wide text-dim hover:text-body"
      >
        Not in this set
        <span className="tnum normal-case">{missing.length}</span>
        {open ? <X className="ml-auto size-3" /> : <span className="ml-auto">Show</span>}
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-line p-1">
          {missing.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onAdd(player.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-sunken"
            >
              <span
                className={cn(
                  "tnum w-8 rounded px-1 text-center text-2xs",
                  POSITION_STYLES[player.position],
                )}
              >
                {player.position}
              </span>
              <span className="flex-1 truncate text-sm text-body">{player.name}</span>
              <span className="text-2xs text-dim">Add to end</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
