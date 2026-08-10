"use client";

import { Link2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { type StackSignal, shortName } from "@/lib/draft/stacks";

/**
 * Only positive correlations get a chip.
 *
 * Negative ones are shown by tinting the team column instead — a red chip
 * carrying a name said the same thing but competed with the player's own name
 * for the row, and the club is the thing the warning is actually about.
 *
 * The partner's name only appears where there is room for it. On the overall
 * board — which already carries rank, team and bye — it pushed the player's own
 * name out of the row, so there the chip is a bare glyph and the name lives in
 * the tooltip.
 */
const CHIP = {
  stack: {
    Icon: Link2,
    explain: (names: string) =>
      `Positive correlation — every touchdown they combine on scores twice for you. Stacks with ${names} on your roster.`,
  },
  handcuff: {
    Icon: Shield,
    explain: (names: string) =>
      `Positive correlation — handcuffing your own back keeps the touches on your roster whichever way the split breaks, and an injury promotes your player. Pairs with ${names}.`,
  },
} as const;

export function StackChip({
  signal,
  showName = false,
}: {
  signal: StackSignal;
  showName?: boolean;
}) {
  if (signal.kind === "conflict") return null;

  const { Icon, explain } = CHIP[signal.kind];
  const names = signal.partners.map((partner) => partner.name).join(", ");

  return (
    <span
      title={explain(names)}
      aria-label={explain(names)}
      className={cn(
        "flex shrink-0 items-center rounded bg-target/10 text-target",
        showName ? "gap-0.5 px-1 py-px text-2xs" : "size-4 justify-center",
      )}
    >
      <Icon className="size-2.5" />
      {showName && (
        <>
          {shortName(signal.partners[0]?.name ?? "")}
          {signal.partners.length > 1 && `+${signal.partners.length - 1}`}
        </>
      )}
    </span>
  );
}

/** Wording for the tinted team cell when a pick overlaps your roster. */
export function conflictTitle(names: string, team: string): string {
  return `Negative correlation — you already have ${names} on ${team}, and they compete with this pick for the same production.`;
}
