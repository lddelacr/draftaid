"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Player, Sentiment } from "@/types";
import { cn } from "@/lib/utils";
import { POSITION_STYLES } from "@/lib/presentation";

/**
 * A player card.
 *
 * The whole card is the drag handle — in a tier board you are moving players
 * constantly, and forcing the pointer onto a narrow grip makes that tedious.
 * The designation buttons stop propagation so marking a player never starts a
 * drag by accident, which is the one collision that matters here.
 */

const DESIGNATIONS: { value: Sentiment; label: string; tone: string }[] = [
  { value: "target", label: "T", tone: "bg-target text-white" },
  { value: "pass", label: "P", tone: "bg-pass text-black" },
  { value: "avoid", label: "A", tone: "bg-avoid text-white" },
];

const EDGE: Record<Sentiment, string> = {
  target: "border-l-target",
  pass: "border-l-pass",
  avoid: "border-l-avoid",
  neutral: "border-l-transparent",
};

interface PlayerCardProps {
  player: Player;
  sentiment: Sentiment;
  /** Shown in the overall view: the player's tier at his own position. */
  tierNote?: string;
  onDesignate: (sentiment: Sentiment) => void;
  dragging?: boolean;
}

export function PlayerCardBody({
  player,
  sentiment,
  tierNote,
  onDesignate,
  dragging,
  listeners,
  attributes,
}: PlayerCardProps & {
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}) {
  return (
    <div
      {...attributes}
      {...listeners}
      className={cn(
        "group flex cursor-grab items-center gap-2 rounded-md border border-l-2 border-line bg-panel py-1 pl-1.5 pr-1",
        "transition-shadow hover:border-line-strong hover:shadow-sm active:cursor-grabbing",
        EDGE[sentiment],
        dragging && "opacity-40",
      )}
    >
      <GripVertical className="size-3 shrink-0 text-dim/60" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-2xs font-medium leading-tight text-body">
          {player.name}
        </span>
        <span className="flex items-center gap-1 text-2xs leading-tight text-dim">
          <span className={cn("rounded px-1", POSITION_STYLES[player.position])}>
            {player.position}
          </span>
          {player.team ?? "FA"}
          {tierNote && <span className="truncate">· {tierNote}</span>}
        </span>
      </span>

      {/* One click to mark, one click on the same key to clear. */}
      <span className="flex shrink-0 items-center gap-px opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {DESIGNATIONS.map(({ value, label, tone }) => (
          <button
            key={value}
            type="button"
            title={`${value[0]?.toUpperCase()}${value.slice(1)}`}
            aria-label={value}
            aria-pressed={sentiment === value}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDesignate(sentiment === value ? "neutral" : value);
            }}
            className={cn(
              "tnum size-4 rounded text-2xs font-semibold leading-none transition-colors",
              sentiment === value ? tone : "bg-sunken text-dim hover:bg-line hover:text-body",
            )}
          >
            {label}
          </button>
        ))}
      </span>

      {sentiment !== "neutral" && (
        <span
          className={cn(
            "shrink-0 rounded px-1 text-2xs font-semibold uppercase group-hover:hidden",
            sentiment === "target" && "text-target",
            sentiment === "pass" && "text-pass",
            sentiment === "avoid" && "text-avoid",
          )}
        >
          {sentiment[0]}
        </span>
      )}
    </div>
  );
}

/** Sortable wrapper. `containerId` tells the board which tier a drop landed in. */
export function SortablePlayerCard({
  containerId,
  ...props
}: PlayerCardProps & { containerId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.player.id, data: { containerId } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "z-10")}
    >
      <PlayerCardBody
        {...props}
        dragging={isDragging}
        listeners={listeners as unknown as Record<string, unknown>}
        attributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  );
}
