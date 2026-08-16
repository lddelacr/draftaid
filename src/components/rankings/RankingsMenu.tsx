"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ListOrdered, Pencil, Plus, Trash2 } from "lucide-react";
import type { RankingSet, RankingSource, ScoringFormat } from "@/types";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/scoring/formats";

/**
 * The ranking switcher.
 *
 * Deliberately a menu rather than a page: choosing which rankings to draft off
 * is a one-second decision that should not navigate away from a live board.
 * Creating and editing open a dedicated surface; everything else happens here.
 */

interface RankingsMenuProps {
  sets: readonly RankingSet[];
  active: RankingSource;
  activeName: string;
  onActivate: (source: RankingSource) => void;
  onCreate: () => void;
  onEdit: (set: RankingSet) => void;
  onDuplicate: (set: RankingSet) => void;
  onDelete: (set: RankingSet) => void;
}

export function RankingsMenu({
  sets,
  active,
  activeName,
  onActivate,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
}: RankingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [open]);

  const isDefault = active.kind === "default";

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Choose which rankings the board uses"
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2 py-1 text-2xs",
          "transition-colors hover:border-line-strong",
          !isDefault && "border-accent/40 text-accent",
        )}
      >
        <ListOrdered className="size-3" />
        <span className="max-w-[11rem] truncate">{activeName}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-line bg-panel shadow-xl shadow-black/10 dark:shadow-black/50">
          <Section>Built in</Section>
          {(["ppr", "half"] as ScoringFormat[]).map((format) => (
            <Row
              key={format}
              label={`Default Guide (${FORMAT_LABELS[format]})`}
              hint="Joel Smyth 2026"
              selected={active.kind === "default" && active.format === format}
              onSelect={() => {
                onActivate({ kind: "default", format });
                setOpen(false);
              }}
            />
          ))}

          <Section>My rankings</Section>
          {sets.length === 0 ? (
            <p className="px-3 py-2 text-2xs leading-relaxed text-dim">
              None yet. Start from the guide and drag players into your own order.
            </p>
          ) : (
            sets.map((set) => (
              <Row
                key={set.id}
                label={set.name}
                hint={`${set.entries.length} players · ${FORMAT_LABELS[set.format]}`}
                selected={active.kind === "custom" && active.setId === set.id}
                onSelect={() => {
                  onActivate({ kind: "custom", setId: set.id });
                  setOpen(false);
                }}
              >
                {confirming === set.id ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(set);
                      setConfirming(null);
                    }}
                    className="rounded bg-avoid px-1.5 py-0.5 text-2xs text-white"
                  >
                    Delete?
                  </button>
                ) : (
                  <>
                    <Action
                      label="Edit"
                      onClick={() => {
                        onEdit(set);
                        setOpen(false);
                      }}
                    >
                      <Pencil className="size-3" />
                    </Action>
                    <Action label="Duplicate" onClick={() => onDuplicate(set)}>
                      <Copy className="size-3" />
                    </Action>
                    <Action
                      label="Delete"
                      danger
                      onClick={() => setConfirming(set.id)}
                    >
                      <Trash2 className="size-3" />
                    </Action>
                  </>
                )}
              </Row>
            ))
          )}

          <button
            type="button"
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
            className="flex w-full items-center gap-1.5 border-t border-line px-3 py-2 text-2xs text-accent transition-colors hover:bg-sunken"
          >
            <Plus className="size-3" /> Create rankings
          </button>
        </div>
      )}
    </div>
  );
}

const Section = ({ children }: { children: React.ReactNode }) => (
  <p className="bg-sunken/60 px-3 py-1 text-2xs uppercase tracking-wide text-dim">
    {children}
  </p>
);

function Row({
  label,
  hint,
  selected,
  onSelect,
  children,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2 px-3 py-1.5 transition-colors hover:bg-sunken",
        selected && "bg-accent/5",
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Check
          className={cn("size-3 shrink-0", selected ? "text-accent" : "text-transparent")}
        />
        <span className="min-w-0">
          <span className="block truncate text-2xs text-body">{label}</span>
          <span className="block truncate text-2xs text-dim">{hint}</span>
        </span>
      </button>
      {children && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {children}
        </span>
      )}
    </div>
  );
}

function Action({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded p-1 transition-colors hover:bg-line",
        danger ? "text-dim hover:text-avoid" : "text-dim hover:text-body",
      )}
    >
      {children}
    </button>
  );
}
