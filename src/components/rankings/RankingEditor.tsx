"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Check, Search, Undo2 } from "lucide-react";
import {
  SKILL_POSITIONS,
  type Player,
  type PlayerId,
  type RankingSet,
  type Sentiment,
  type SkillPosition,
} from "@/types";
import { cn } from "@/lib/utils";
import { POSITION_STYLES } from "@/lib/presentation";
import { matches } from "@/hooks/useFilteredPlayers";
import * as ops from "@/lib/rankings/sets";
import { PlayerCardBody } from "./PlayerCard";
import { POOL_ID, PlayerPool, TierBoard } from "./TierBoard";
import { OverallList } from "./OverallList";

/**
 * The rankings editor.
 *
 * Two modes behind one set of tabs, because they are genuinely different jobs:
 * a position tab is a tier board (how good is this player *for a quarterback*),
 * and the Overall tab is a flat 1..N draft order. Neither writes to the other —
 * dragging a QB from tier 1 to tier 3 leaves his overall rank alone, and moving
 * him to #2 overall leaves his tier alone. Designations sit outside both.
 */

type Tab = SkillPosition | "overall";
type StatusFilter = "all" | Sentiment;

const TABS: { id: Tab; label: string }[] = [
  { id: "overall", label: "Overall" },
  ...SKILL_POSITIONS.map((position) => ({ id: position as Tab, label: position })),
];

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "target", label: "Target" },
  { id: "pass", label: "Pass" },
  { id: "avoid", label: "Avoid" },
  { id: "neutral", label: "Unmarked" },
];

interface RankingEditorProps {
  set: RankingSet;
  players: readonly Player[];
  canUndo: boolean;
  saving: boolean;
  onChange: (set: RankingSet) => void;
  onRename: (name: string) => void;
  onUndo: () => void;
  onClose: () => void;
}

export function RankingEditor({
  set,
  players,
  canUndo,
  saving,
  onChange,
  onRename,
  onUndo,
  onClose,
}: RankingEditorProps) {
  const [tab, setTab] = useState<Tab>("overall");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dragging, setDragging] = useState<Player | null>(null);

  const sensors = useSensors(
    // A small distance threshold keeps a click on a designation button from
    // registering as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  /**
   * Collision detection.
   *
   * `closestCenter` compares distances between element centres, which is wrong
   * for a tier board: a tall tier's centre can be further from the pointer than
   * the centre of the short tier above it, so releasing inside tier 3 could
   * drop into tier 2. That was the misplacement bug.
   *
   * Pointer containment is the correct test — whichever droppable rectangle the
   * cursor is literally inside wins, regardless of size or centre distance. The
   * rect-intersection fallback only covers keyboard dragging, where there is no
   * pointer to test.
   */
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      // A card sits inside its tier, so both collide. Prefer the card (precise
      // insertion point) but fall back to the container it belongs to.
      const cardHit = pointerHits.find((hit) => hit.id !== POOL_ID && playersById.has(String(hit.id)));
      return cardHit ? [cardHit] : pointerHits;
    }
    const intersections = rectIntersection(args);
    return getFirstCollision(intersections) ? intersections : [];
  };

  const playersById = useMemo(
    () => new Map<string, Player>(players.map((player) => [player.id, player])),
    [players],
  );

  const designationOf = (id: string): Sentiment => set.designations[id] ?? "neutral";

  /**
   * Every tier edit goes through here.
   *
   * While the overall list is still exactly what generation produced, tier
   * changes refresh it automatically — that is what makes "build four short
   * tier boards, get a 1..N ranking" work without a manual step. The moment the
   * user reorders the overall list themselves it stops following, and only the
   * explicit rebuild will replace it.
   */
  const commitTiers = (next: RankingSet) =>
    onChange(ops.syncOverallIfUntouched(next, players));

  /** Filters only change what is dimmed — never what a tier contains. */
  const isFiltered = (player: Player): boolean => {
    if (status !== "all" && designationOf(player.id) !== status) return true;
    return !matches(player, query);
  };
  const filtering = query.trim().length > 0 || status !== "all";

  const designate = (playerId: string, sentiment: Sentiment) =>
    onChange(ops.designate(set, playerId as PlayerId, sentiment));

  /** Where a player sits at his own position, shown as context in Overall. */
  const tierNoteOf = (player: Player): string | undefined => {
    if (!SKILL_POSITIONS.includes(player.position as SkillPosition)) return undefined;
    const tiers = ops.tiersFor(set, player.position as SkillPosition);
    const index = tiers.findIndex((tier) => tier.playerIds.includes(player.id));
    return index === -1 ? undefined : `${player.position} · ${tiers[index]?.name}`;
  };

  const overallPlayers = useMemo(
    () =>
      set.overall.flatMap((id) => {
        const player = playersById.get(id);
        return player ? [player] : [];
      }),
    [set.overall, playersById],
  );

  const notRanked = useMemo(() => ops.missingFromOverall(set, players), [set, players]);

  const position = tab === "overall" ? null : tab;
  const pool = useMemo(
    () => (position ? ops.poolFor(set, position, players) : []),
    [set, position, players],
  );

  const containerOf = (id: string): string | null => {
    if (tab === "overall") return "overall";
    if (!position) return null;
    const tier = ops.tiersFor(set, position).find((entry) =>
      entry.playerIds.includes(id as PlayerId),
    );
    if (tier) return tier.id;
    return pool.some((player) => player.id === id) ? POOL_ID : null;
  };

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (tab === "overall") {
      const from = set.overall.indexOf(activeId as PlayerId);
      const to = set.overall.indexOf(overId as PlayerId);
      if (from === -1 || to === -1 || from === to) return;
      onChange(ops.moveOverall(set, from, to));
      return;
    }

    if (!position) return;

    // The drop target is either a container (a tier or the pool) or another
    // card, in which case we take that card's container and slot in beside it.
    const overContainer =
      (over.data.current?.containerId as string | undefined) ??
      (overId === POOL_ID ? POOL_ID : containerOf(overId)) ??
      overId;
    const fromContainer = containerOf(activeId);
    if (!overContainer || !fromContainer) return;

    if (overContainer === POOL_ID) {
      commitTiers(ops.placePlayer(set, position, activeId as PlayerId, null));
      return;
    }

    const targetTier = ops.tiersFor(set, position).find((tier) => tier.id === overContainer);
    if (!targetTier) return;

    if (fromContainer === overContainer) {
      const from = targetTier.playerIds.indexOf(activeId as PlayerId);
      const to = targetTier.playerIds.indexOf(overId as PlayerId);
      if (from === -1 || to === -1 || from === to) return;
      const reordered = arrayMove([...targetTier.playerIds], from, to);
      commitTiers(
        ops.placePlayer(
          set,
          position,
          activeId as PlayerId,
          targetTier.id,
          reordered.indexOf(activeId as PlayerId),
        ),
      );
      return;
    }

    const at = targetTier.playerIds.indexOf(overId as PlayerId);
    commitTiers(
      ops.placePlayer(
        set,
        position,
        activeId as PlayerId,
        targetTier.id,
        at === -1 ? undefined : at,
      ),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-2">
        <input
          value={set.name}
          onChange={(event) => onRename(event.target.value)}
          aria-label="Ranking set name"
          className="min-w-0 max-w-xs flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-body hover:border-line focus:border-accent/40 focus:bg-sunken"
        />

        <span className="flex items-center gap-1 text-2xs text-dim">
          {saving ? (
            "Saving…"
          ) : (
            <>
              <Check className="size-3 text-target" /> Saved
            </>
          )}
        </span>

        <span className="ml-auto flex items-center gap-1">
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
            className="rounded-md bg-accent px-3 py-1.5 text-2xs font-medium text-accent-ink"
          >
            Done
          </button>
        </span>
      </header>

      <nav className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex gap-0.5 rounded-lg bg-sunken p-0.5">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                "rounded-md px-2.5 py-1 text-2xs font-medium transition-colors",
                tab === id
                  ? "bg-panel text-body shadow-sm"
                  : "text-muted hover:text-body",
                tab !== id && id !== "overall" && POSITION_STYLES[id as SkillPosition].split(" ")[0],
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="relative flex min-w-[10rem] max-w-xs flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players"
            className="w-full rounded-md border border-line bg-sunken py-1.5 pl-8 pr-2 text-2xs text-body placeholder:text-dim focus:border-accent/40"
          />
        </label>

        <div className="flex gap-0.5 rounded-lg bg-sunken p-0.5">
          {STATUSES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatus(id)}
              aria-pressed={status === id}
              className={cn(
                "rounded-md px-2 py-1 text-2xs transition-colors",
                status === id ? "bg-panel text-body shadow-sm" : "text-muted hover:text-body",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {filtering && (
          <span className="text-2xs text-dim">Filtering dims players — nothing moves</span>
        )}
      </nav>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(event: DragStartEvent) =>
          setDragging(playersById.get(String(event.active.id)) ?? null)
        }
        onDragCancel={() => setDragging(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="min-h-0 flex-1 overflow-hidden p-2">
          {tab === "overall" ? (
            <div className="h-full min-h-0">
              <OverallList
                players={overallPlayers}
                designationOf={designationOf}
                tierNoteOf={tierNoteOf}
                onDesignate={designate}
                onRemove={(playerId) =>
                  onChange(ops.removeFromOverall(set, playerId as PlayerId))
                }
                isFiltered={isFiltered}
                filtering={filtering}
                onRebuild={() => onChange(ops.rebuildOverall(set, players))}
                handEdited={ops.overallIsHandEdited(set)}
                unranked={notRanked}
                onAdd={(playerId) => onChange(ops.addToOverall(set, playerId as PlayerId))}
              />
            </div>
          ) : (
            position && (
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="min-h-0 overflow-y-auto pb-2 pr-1">
                  <TierBoard
                    tiers={ops.tiersFor(set, position)}
                    playersById={playersById}
                    designationOf={designationOf}
                    onAddTier={() => commitTiers(ops.addTier(set, position))}
                    onRenameTier={(tierId, name) =>
                      commitTiers(ops.renameTier(set, position, tierId, name))
                    }
                    onDeleteTier={(tierId) => commitTiers(ops.deleteTier(set, position, tierId))}
                    onClearTier={(tierId) => commitTiers(ops.clearTier(set, position, tierId))}
                    onMoveTier={(from, to) => commitTiers(ops.moveTier(set, position, from, to))}
                    onDesignate={designate}
                    isFiltered={isFiltered}
                    filtering={filtering}
                  />
                </div>
                <PlayerPool
                  players={pool}
                  designationOf={designationOf}
                  onDesignate={designate}
                  isFiltered={isFiltered}
                  filtering={filtering}
                />
              </div>
            )
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="w-44 rotate-1 shadow-lg">
              <PlayerCardBody
                player={dragging}
                sentiment={designationOf(dragging.id)}
                onDesignate={() => undefined}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <footer className="flex items-center gap-3 border-t border-line bg-panel px-3 py-1.5 text-2xs text-dim">
        <span>Drag cards between tiers</span>
        <span>T / P / A buttons mark a player</span>
        <span>Positional tiers and overall rank are independent</span>
      </footer>
    </div>
  );
}
