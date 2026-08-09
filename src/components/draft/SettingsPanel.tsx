"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { type LeagueSettings, type ScoringFormat, teamSlot } from "@/types";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LINEUP,
  FORMAT_LABELS,
  SUPERFLEX_LINEUP,
  rosterSize,
} from "@/lib/scoring/formats";

interface SettingsPanelProps {
  open: boolean;
  settings: LeagueSettings;
  hasPicks: boolean;
  onChange: (settings: LeagueSettings) => void;
  onClose: () => void;
}

const TEAM_COUNTS = [8, 10, 12, 14, 16];

export function SettingsPanel({
  open,
  settings,
  hasPicks,
  onChange,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null;

  const superflex = settings.lineup.SUPERFLEX > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-body/30 backdrop-blur-sm"
      >
        <motion.div
          role="dialog"
          aria-label="League settings"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          onClick={(event) => event.stopPropagation()}
          className="mx-auto mt-[10vh] w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-5 shadow-xl shadow-black/10 dark:shadow-black/50"
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-body">League settings</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-dim hover:text-body"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-5">
            <Field label="Scoring" hint="Both boards come from the guide.">
              <Segmented
                options={(["ppr", "half"] as ScoringFormat[]).map((value) => ({
                  value,
                  label: FORMAT_LABELS[value],
                }))}
                value={settings.format}
                onChange={(format) => onChange({ ...settings, format })}
              />
            </Field>

            <Field label="Teams" hint={hasPicks ? "Changing this clears the board." : undefined}>
              <Segmented
                options={TEAM_COUNTS.map((value) => ({ value, label: String(value) }))}
                value={settings.teamCount}
                onChange={(teamCount) =>
                  onChange({
                    ...settings,
                    teamCount,
                    mySlot: teamSlot(Math.min(settings.mySlot, teamCount)),
                  })
                }
              />
            </Field>

            <Field label="Your seat">
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: settings.teamCount }, (_, index) => index + 1).map(
                  (slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onChange({ ...settings, mySlot: teamSlot(slot) })}
                      aria-pressed={settings.mySlot === slot}
                      className={cn(
                        "tnum size-8 rounded-md text-2xs transition-colors",
                        settings.mySlot === slot
                          ? "bg-accent text-accent-ink"
                          : "bg-sunken text-muted hover:bg-sunken",
                      )}
                    >
                      {slot}
                    </button>
                  ),
                )}
              </div>
            </Field>

            <Field label="Rounds" hint={`${rosterSize(settings.lineup)} roster spots`}>
              <input
                type="range"
                min={10}
                max={20}
                value={settings.rounds}
                onChange={(event) =>
                  onChange({ ...settings, rounds: Number(event.target.value) })
                }
                className="w-full accent-accent"
              />
              <span className="tnum text-2xs text-muted">{settings.rounds} rounds</span>
            </Field>

            <Field
              label="Superflex"
              hint="Adds a second slot that accepts a quarterback."
            >
              <Segmented
                options={[
                  { value: false, label: "Off" },
                  { value: true, label: "On" },
                ]}
                value={superflex}
                onChange={(on) =>
                  onChange({ ...settings, lineup: on ? SUPERFLEX_LINEUP : DEFAULT_LINEUP })
                }
              />
            </Field>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xs uppercase tracking-wide text-dim">{label}</span>
        {hint && <span className="text-2xs text-dim">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string | number | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-sunken p-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-2xs transition-colors",
            value === option.value
              ? "bg-line text-body"
              : "text-muted hover:text-body",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
