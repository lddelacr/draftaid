"use client";

import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { GripVertical, Plus, RefreshCw, X } from "lucide-react";
import type { Player, Sentiment } from "@/types";
import { cn } from "@/lib/utils";
import { POSITION_STYLES } from "@/lib/presentation";

/**
 * The overall ranking.
 *
 * Deliberately not a tier board: this is a flat 1..N list where any player can
 * sit at any rank, and the number is read off list position rather than typed.
 * A QB in positional tier 1 sitting 40th here is a legitimate opinion, so the
 * view shows his tier as context and never as a constraint.
 */

interface OverallListProps {
  players: readonly Player[];
  /** Rebuild the list from the tier boards. */
  onRebuild: () => void;
  /** True when the list has been hand edited since it was generated. */
  handEdited: boolean;
  designationOf: (id: string) => Sentiment;
  tierNoteOf: (player: Player) => string | undefined;
  onDesignate: (playerId: string, sentiment: Sentiment) => void;
  onRemove: (playerId: string) => void;
  /** Hidden by filter — dimmed rather than pulled out, so ranks stay honest. */
  isFiltered: (player: Player) => boolean;
  filtering: boolean;
  unranked: readonly Player[];
  onAdd: (playerId: string) => void;
}

const DESIGNATIONS: { value: Sentiment; label: string; tone: string }[] = [
  { value: "target", label: "T", tone: "bg-target text-white" },
  { value: "pass", label: "P", tone: "bg-pass text-black" },
  { value: "avoid", label: "A", tone: "bg-avoid text-white" },
];

export function OverallList({
  players,
  onRebuild,
  handEdited,
  designationOf,
  tierNoteOf,
  onDesignate,
  onRemove,
  isFiltered,
  filtering,
  unranked,
  onAdd,
}: OverallListProps) {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
          <h2 className="text-2xs font-medium uppercase tracking-wide text-muted">
            Overall ranking
          </h2>
          <span className="tnum text-2xs text-dim">{players.length}</span>
          {handEdited && (
            <span className="rounded bg-sunken px-1.5 py-px text-2xs text-dim">
              edited by hand
            </span>
          )}
          <RebuildButton onRebuild={onRebuild} handEdited={handEdited} />
        </div>

        <header className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1 text-2xs uppercase tracking-wide text-dim">
          <span className="w-8 text-right">#</span>
          <span className="flex-1">Player</span>
          <span className="w-24">Tier context</span>
          <span className="w-16 text-center">Mark</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {players.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-dim">
              No overall ranking yet. Add players from the right.
            </p>
          ) : (
            <SortableContext
              items={players.map((player) => player.id)}
              strategy={verticalListSortingStrategy}
            >
              {players.map((player, index) => (
                <OverallRow
                  key={player.id}
                  player={player}
                  rank={index + 1}
                  sentiment={designationOf(player.id)}
                  tierNote={tierNoteOf(player)}
                  dimmed={filtering && isFiltered(player)}
                  onDesignate={(sentiment) => onDesignate(player.id, sentiment)}
                  onRemove={() => onRemove(player.id)}
                />
              ))}
            </SortableContext>
          )}
        </div>
      </div>

      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-2">
          <h2 className="text-2xs font-medium uppercase tracking-wide text-muted">Not ranked</h2>
          <span className="tnum text-2xs text-dim">{unranked.length}</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {unranked.length === 0 ? (
            <p className="px-2 py-8 text-center text-2xs leading-relaxed text-dim">
              Every player is in your overall ranking.
            </p>
          ) : (
            unranked.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => onAdd(player.id)}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-sunken"
              >
                <span
                  className={cn(
                    "shrink-0 rounded px-1 text-2xs",
                    POSITION_STYLES[player.position],
                  )}
                >
                  {player.position}
                </span>
                <span className="min-w-0 flex-1 truncate text-2xs text-body">
                  {player.name}
                </span>
                <Plus className="size-3 shrink-0 text-dim" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Rebuilding throws away manual ordering, so it confirms once the list has been
 * hand edited — and goes straight through when it has not, where there is
 * nothing to lose.
 */
function RebuildButton({
  onRebuild,
  handEdited,
}: {
  onRebuild: () => void;
  handEdited: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="ml-auto flex items-center gap-1">
        <span className="text-2xs text-dim">Replace your manual order?</span>
        <button
          type="button"
          onClick={() => {
            onRebuild();
            setConfirming(false);
          }}
          className="rounded bg-avoid px-1.5 py-0.5 text-2xs text-white"
        >
          Rebuild
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded px-1.5 py-0.5 text-2xs text-muted hover:text-body"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      title="Rebuild this list from your positional tiers"
      onClick={() => (handEdited ? setConfirming(true) : onRebuild())}
      className="ml-auto flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-2xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
    >
      <RefreshCw className="size-3" /> Rebuild from tiers
    </button>
  );
}

function OverallRow({
  player,
  rank,
  sentiment,
  tierNote,
  dimmed,
  onDesignate,
  onRemove,
}: {
  player: Player;
  rank: number;
  sentiment: Sentiment;
  tierNote?: string;
  dimmed: boolean;
  onDesignate: (sentiment: Sentiment) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id, data: { containerId: "overall" } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-sunken",
        isDragging && "opacity-40",
        dimmed && "opacity-25",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center gap-1.5 active:cursor-grabbing"
      >
        <GripVertical className="size-3 shrink-0 text-dim/60" />
        <span className="tnum w-7 text-right text-2xs text-dim">{rank}</span>
      </span>

      <span
        {...attributes}
        {...listeners}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
      >
        <span className={cn("shrink-0 rounded px-1 text-2xs", POSITION_STYLES[player.position])}>
          {player.position}
        </span>
        <span className="truncate text-2xs text-body">{player.name}</span>
        <span className="shrink-0 text-2xs text-dim">{player.team ?? "FA"}</span>
      </span>

      <span className="w-24 shrink-0 truncate text-2xs text-dim">{tierNote ?? "—"}</span>

      <span className="flex w-16 shrink-0 items-center justify-center gap-px">
        {DESIGNATIONS.map(({ value, label, tone }) => (
          <button
            key={value}
            type="button"
            aria-label={value}
            aria-pressed={sentiment === value}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDesignate(sentiment === value ? "neutral" : value)}
            className={cn(
              "tnum size-4 rounded text-2xs font-semibold leading-none transition-colors",
              sentiment === value
                ? tone
                : "bg-sunken text-dim opacity-0 hover:bg-line hover:text-body group-hover:opacity-100",
            )}
          >
            {label}
          </button>
        ))}
      </span>

      <button
        type="button"
        title="Remove from overall ranking"
        aria-label="Remove from overall ranking"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-dim opacity-0 transition-opacity hover:text-avoid group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
