"use client";

import { Ban, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type StackSignal, shortName } from "@/lib/draft/stacks";

/**
 * Stack chips carry an icon as well as a colour.
 *
 * The guide already owns green and red for target and avoid, and those marks
 * sit on the same row. The icon is what actually distinguishes the two systems:
 * a link means "pairs with someone you own", a bar means "overlaps with someone
 * you own". Colour is the secondary cue, not the only one.
 */
export function StackChip({ signal }: { signal: StackSignal }) {
  const stack = signal.kind === "stack";
  const names = signal.partners.map((partner) => partner.name).join(", ");
  const Icon = stack ? Link2 : Ban;

  return (
    <span
      title={
        stack
          ? `Stacks with ${names} on your roster`
          : `Overlaps with ${names} on your roster`
      }
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-2xs",
        stack ? "bg-target/10 text-target" : "bg-avoid/10 text-avoid",
      )}
    >
      <Icon className="size-2.5" />
      {shortName(signal.partners[0]?.name ?? "")}
      {signal.partners.length > 1 && `+${signal.partners.length - 1}`}
    </span>
  );
}
