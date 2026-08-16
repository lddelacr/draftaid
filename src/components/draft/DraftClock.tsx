"use client";

import { Moon, RotateCcw, Sun, Undo2 } from "lucide-react";
import {
  type DraftState,
  type LeagueSettings,
  type RankingSet,
  type RankingSource,
  teamSlot,
} from "@/types";
import { RankingsMenu } from "@/components/rankings/RankingsMenu";
import { cn } from "@/lib/utils";
import {
  currentPick,
  isComplete,
  isMyPick,
  onTheClock,
  picksBeforeMyNext,
} from "@/lib/draft/selectors";
import { roundOf } from "@/lib/draft/snake";
import type { Theme } from "@/hooks/useTheme";

interface DraftClockProps {
  state: DraftState;
  theme: Theme;
  onToggleTheme: () => void;
  onSettings: (settings: LeagueSettings) => void;
  onUndo: () => void;
  onReset: () => void;
  rankingSets: readonly RankingSet[];
  activeRanking: RankingSource;
  activeRankingName: string;
  onActivateRanking: (source: RankingSource) => void;
  onCreateRanking: () => void;
  onEditRanking: (set: RankingSet) => void;
  onDuplicateRanking: (set: RankingSet) => void;
  onDeleteRanking: (set: RankingSet) => void;
}

const TEAM_COUNTS = [8, 10, 12, 14, 16];

/**
 * League setup lives here rather than behind a dialog: which rankings, league
 * size and your seat are the three things you check before every draft, and
 * burying them one click deep made it unclear they existed at all.
 *
 * Scoring format now rides on the ranking source — choosing the PPR or
 * half-PPR guide *is* the format choice — so it is no longer a separate
 * control that could disagree with the board on screen.
 */
export function DraftClock({
  state,
  theme,
  onToggleTheme,
  onSettings,
  onUndo,
  onReset,
  rankingSets,
  activeRanking,
  activeRankingName,
  onActivateRanking,
  onCreateRanking,
  onEditRanking,
  onDuplicateRanking,
  onDeleteRanking,
}: DraftClockProps) {
  const pick = currentPick(state);
  const { teamCount, mySlot } = state.settings;
  const mine = isMyPick(state);
  const done = isComplete(state);
  const away = picksBeforeMyNext(state);
  const inRound = ((pick - 1) % teamCount) + 1;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-3 py-2">
      <span className="text-sm font-semibold tracking-tight text-body">Draftaid</span>

      <RankingsMenu
        sets={rankingSets}
        active={activeRanking}
        activeName={activeRankingName}
        onActivate={onActivateRanking}
        onCreate={onCreateRanking}
        onEdit={onEditRanking}
        onDuplicate={onDuplicateRanking}
        onDelete={onDeleteRanking}
      />

      <Select
        label="Teams"
        value={String(teamCount)}
        onChange={(value) => {
          const next = Number(value);
          onSettings({
            ...state.settings,
            teamCount: next,
            mySlot: teamSlot(Math.min(mySlot, next)),
          });
        }}
        options={TEAM_COUNTS.map((count) => ({ value: String(count), label: `${count} teams` }))}
      />

      <Select
        label="My seat"
        value={String(mySlot)}
        onChange={(value) => onSettings({ ...state.settings, mySlot: teamSlot(Number(value)) })}
        options={Array.from({ length: teamCount }, (_, index) => ({
          value: String(index + 1),
          label: `Pick ${index + 1}`,
        }))}
      />

      <span className="mx-1 h-4 w-px bg-line" />

      <div className="flex items-center gap-3">
        <Stat
          label="Round"
          value={done ? "—" : `${roundOf(pick, teamCount)}.${String(inRound).padStart(2, "0")}`}
        />
        <Stat label="Pick" value={done ? "Done" : `#${pick}`} />
      </div>

      {!done && (
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-2xs font-medium",
            mine ? "bg-accent text-accent-ink" : "bg-sunken text-muted",
          )}
        >
          {mine
            ? "You're up"
            : away === null
              ? `Seat ${onTheClock(state)} on the clock`
              : `${away} pick${away === 1 ? "" : "s"} until you`}
        </span>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        <span className="mr-1.5 text-2xs lowercase text-dim">by: lunce</span>
        <IconButton
          label={theme === "dark" ? "Switch to light" : "Switch to dark"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>
        <IconButton label="Undo last pick (⌘Z)" onClick={onUndo} disabled={!state.picks.length}>
          <Undo2 className="size-4" />
        </IconButton>
        <IconButton label="Reset board" onClick={onReset} disabled={!state.picks.length}>
          <RotateCcw className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-2xs uppercase tracking-wide text-dim">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "rounded-md border border-line bg-sunken px-1.5 py-1 text-2xs text-body",
          "transition-colors hover:border-line-strong focus:border-accent/40",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-2xs uppercase tracking-wide text-dim">{label}</span>
      <span className="tnum text-sm text-body">{value}</span>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-body",
        "disabled:pointer-events-none disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
