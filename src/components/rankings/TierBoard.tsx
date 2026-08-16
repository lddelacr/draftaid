"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronUp, Eraser, Plus, Trash2 } from "lucide-react";
import type { Player, RankingTier, Sentiment } from "@/types";
import { cn } from "@/lib/utils";
import { SortablePlayerCard } from "./PlayerCard";

/**
 * The tier board.
 *
 * Tiers read top to bottom as strongest to weakest, so the label rail sits on
 * the left where the eye starts and the cards flow in a grid to its right —
 * the shape of a tier list, not a table of rows. Empty tiers keep their height
 * so a drop target never disappears just because it is unused.
 */

export const POOL_ID = "pool";

interface TierBoardProps {
  tiers: readonly RankingTier[];
  playersById: Map<string, Player>;
  designationOf: (id: string) => Sentiment;
  onAddTier: () => void;
  onRenameTier: (tierId: string, name: string) => void;
  onDeleteTier: (tierId: string) => void;
  onClearTier: (tierId: string) => void;
  onMoveTier: (from: number, to: number) => void;
  onDesignate: (playerId: string, sentiment: Sentiment) => void;
  /** Hidden by search or status filter — dimmed, never removed from its tier. */
  isFiltered: (player: Player) => boolean;
  filtering: boolean;
}

export function TierBoard({
  tiers,
  playersById,
  designationOf,
  onAddTier,
  onRenameTier,
  onDeleteTier,
  onClearTier,
  onMoveTier,
  onDesignate,
  isFiltered,
  filtering,
}: TierBoardProps) {
  return (
    <div className="space-y-1.5">
      {tiers.map((tier, index) => (
        <TierRow
          key={tier.id}
          tier={tier}
          index={index}
          total={tiers.length}
          playersById={playersById}
          designationOf={designationOf}
          onRename={(name) => onRenameTier(tier.id, name)}
          onDelete={() => onDeleteTier(tier.id)}
          onClear={() => onClearTier(tier.id)}
          onMove={(direction) => onMoveTier(index, index + direction)}
          onDesignate={onDesignate}
          isFiltered={isFiltered}
          filtering={filtering}
        />
      ))}

      <button
        type="button"
        onClick={onAddTier}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-2xs text-dim transition-colors hover:border-accent/40 hover:text-accent"
      >
        <Plus className="size-3" /> Add tier
      </button>
    </div>
  );
}

function TierRow({
  tier,
  index,
  total,
  playersById,
  designationOf,
  onRename,
  onDelete,
  onClear,
  onMove,
  onDesignate,
  isFiltered,
  filtering,
}: {
  tier: RankingTier;
  index: number;
  total: number;
  playersById: Map<string, Player>;
  designationOf: (id: string) => Sentiment;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onMove: (direction: number) => void;
  onDesignate: (playerId: string, sentiment: Sentiment) => void;
  isFiltered: (player: Player) => boolean;
  filtering: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tier.id, data: { containerId: tier.id } });
  const [confirming, setConfirming] = useState(false);

  const players = tier.playerIds.flatMap((id) => {
    const player = playersById.get(id);
    return player ? [player] : [];
  });

  /** Tier 1 reads darkest and the ladder lightens — depth, not a rainbow. */
  const weight = Math.min(index, 5);
  const railTone = [
    "bg-accent/15 text-accent",
    "bg-sunken text-body",
    "bg-sunken text-muted",
    "bg-sunken/70 text-muted",
    "bg-sunken/50 text-dim",
    "bg-sunken/30 text-dim",
  ][weight];

  return (
    <div
      className={cn(
        "group/tier flex overflow-hidden rounded-lg border border-line bg-panel transition-colors",
        isOver && "border-accent ring-1 ring-accent",
      )}
    >
      <div className={cn("flex w-28 shrink-0 flex-col justify-between gap-1 p-1.5", railTone)}>
        <input
          value={tier.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label={`Tier ${index + 1} name`}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-2xs font-semibold uppercase tracking-wide hover:border-line focus:border-accent/40 focus:bg-panel"
        />
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/tier:opacity-100 focus-within:opacity-100">
          <RailButton label="Move tier up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp className="size-3" />
          </RailButton>
          <RailButton
            label="Move tier down"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="size-3" />
          </RailButton>
          <RailButton
            label="Empty this tier"
            disabled={players.length === 0}
            onClick={onClear}
          >
            <Eraser className="size-3" />
          </RailButton>
          {confirming ? (
            <button
              type="button"
              onClick={onDelete}
              onBlur={() => setConfirming(false)}
              className="rounded bg-avoid px-1 text-2xs text-white"
            >
              Sure?
            </button>
          ) : (
            <RailButton label="Delete tier" onClick={() => setConfirming(true)}>
              <Trash2 className="size-3" />
            </RailButton>
          )}
        </div>
      </div>

      <SortableContext items={[...tier.playerIds]} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "grid min-h-[3.25rem] flex-1 content-start gap-1 p-1.5",
            "grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]",
            isOver && "bg-accent/5",
          )}
        >
          {players.length === 0 ? (
            <p className="col-span-full self-center text-center text-2xs text-dim">
              Drag players here
            </p>
          ) : (
            players.map((player) => (
              <div
                key={player.id}
                className={cn(filtering && isFiltered(player) && "opacity-25")}
              >
                <SortablePlayerCard
                  player={player}
                  containerId={tier.id}
                  sentiment={designationOf(player.id)}
                  onDesignate={(sentiment) => onDesignate(player.id, sentiment)}
                />
              </div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function RailButton({
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
      onClick={onClick}
      className="rounded p-0.5 transition-colors hover:bg-panel/60 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Unplaced players for the position on screen. Drop here to unrank. */
export function PlayerPool({
  players,
  designationOf,
  onDesignate,
  isFiltered,
  filtering,
}: {
  players: readonly Player[];
  designationOf: (id: string) => Sentiment;
  onDesignate: (playerId: string, sentiment: Sentiment) => void;
  isFiltered: (player: Player) => boolean;
  filtering: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID, data: { containerId: POOL_ID } });
  const visible = filtering ? players.filter((player) => !isFiltered(player)) : players;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <header className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-muted">Unranked</h2>
        <span className="tnum text-2xs text-dim">{players.length}</span>
      </header>

      <SortableContext items={visible.map((player) => player.id)} strategy={rectSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5",
            isOver && "bg-accent/5 ring-1 ring-inset ring-accent",
          )}
        >
          {visible.length === 0 ? (
            <p className="px-1 py-8 text-center text-2xs leading-relaxed text-dim">
              {players.length === 0
                ? "Everyone at this position is in a tier."
                : "Nobody matches the current filter."}
            </p>
          ) : (
            visible.map((player) => (
              <SortablePlayerCard
                key={player.id}
                player={player}
                containerId={POOL_ID}
                sentiment={designationOf(player.id)}
                onDesignate={(sentiment) => onDesignate(player.id, sentiment)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
