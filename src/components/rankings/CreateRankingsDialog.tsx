"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ScoringFormat } from "@/types";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/scoring/formats";

/**
 * Creating a set is two decisions — what to call it and what to start from —
 * so it stays a small dialog rather than a wizard. "Start from the guide" is
 * the default because rebuilding 250 players by hand is nobody's workflow.
 */
export function CreateRankingsDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, format: ScoringFormat, from: "default" | "blank") => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("My 2026 Rankings");
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const [from, setFrom] = useState<"default" | "blank">("default");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-body/30 backdrop-blur-sm"
    >
      <motion.div
        role="dialog"
        aria-label="Create rankings"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="mx-auto mt-[12vh] w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-body">Create rankings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-dim hover:text-body"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-2xs uppercase tracking-wide text-dim">Name</span>
            <input
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim()) onCreate(name, format, from);
              }}
              className="w-full rounded-md border border-line bg-sunken px-2 py-1.5 text-sm text-body focus:border-accent/40"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-2xs uppercase tracking-wide text-dim">Start from</span>
            <Choice
              selected={from === "default"}
              onSelect={() => setFrom("default")}
              title="The default guide"
              detail="Copies every player, tier and mark into a set you own. Edit from there."
            />
            <Choice
              selected={from === "blank"}
              onSelect={() => setFrom("blank")}
              title="Blank"
              detail="Start with nothing and add players yourself."
            />
          </div>

          {from === "default" && (
            <div className="space-y-1.5">
              <span className="text-2xs uppercase tracking-wide text-dim">Which board</span>
              <div className="flex gap-1 rounded-lg bg-sunken p-1">
                {(["ppr", "half"] as ScoringFormat[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFormat(option)}
                    aria-pressed={format === option}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-2xs transition-colors",
                      format === option ? "bg-panel text-body shadow-sm" : "text-muted",
                    )}
                  >
                    {FORMAT_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onCreate(name, format, from)}
            className="w-full rounded-md bg-accent py-2 text-2xs font-medium text-accent-ink disabled:opacity-40"
          >
            Create and edit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Choice({
  selected,
  onSelect,
  title,
  detail,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full gap-2 rounded-md border p-2 text-left transition-colors",
        selected ? "border-accent/50 bg-accent/5" : "border-line hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "mt-0.5 size-3 shrink-0 rounded-full border",
          selected ? "border-accent bg-accent" : "border-line-strong",
        )}
      />
      <span>
        <span className="block text-2xs font-medium text-body">{title}</span>
        <span className="block text-2xs leading-relaxed text-dim">{detail}</span>
      </span>
    </button>
  );
}
