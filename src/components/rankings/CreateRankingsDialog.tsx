"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ScoringFormat } from "@/types";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS } from "@/lib/scoring/formats";

/**
 * Creating a set is one decision — what to call it — plus which board to copy.
 * There is no blank option: users are adjusting an existing ranking, not
 * authoring one, so an empty set would only ever be a chore to fill in.
 */
export function CreateRankingsDialog({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, format: ScoringFormat) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("My 2026 Rankings");
  const [format, setFormat] = useState<ScoringFormat>("ppr");

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
                if (event.key === "Enter" && name.trim()) onCreate(name, format);
              }}
              className="w-full rounded-md border border-line bg-sunken px-2 py-1.5 text-sm text-body focus:border-accent/40"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-2xs uppercase tracking-wide text-dim">Based on</span>
            <p className="rounded-md border border-line bg-sunken px-2 py-1.5 text-2xs leading-relaxed text-muted">
              A full copy of the default rankings — overall order, every
              position&apos;s tiers, and existing target/pass/avoid marks. Edit the
              copy; the original never changes.
            </p>
          </div>

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

          <button
            type="button"
            disabled={!name.trim()}
            onClick={() => onCreate(name, format)}
            className="w-full rounded-md bg-accent py-2 text-2xs font-medium text-accent-ink disabled:opacity-40"
          >
            Create and edit
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
