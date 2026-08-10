"use client";

import { Ban, Link2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { type StackSignal, shortName } from "@/lib/draft/stacks";

/**
 * Stack chips carry an icon as well as a colour.
 *
 * The guide already owns green and red for target and avoid, and those marks
 * sit on the same row, so the icon is what actually separates the two systems:
 * a link pairs, a shield insures, a bar overlaps. Colour is the secondary cue.
 * Stacks and handcuffs share the green rather than taking a third hue, because
 * they say the same thing — this pick works with what you already hold.
 */
const CHIP = {
  stack: { Icon: Link2, tone: "bg-target/10 text-target", verb: "Stacks with" },
  handcuff: { Icon: Shield, tone: "bg-target/10 text-target", verb: "Handcuffs" },
  conflict: { Icon: Ban, tone: "bg-avoid/10 text-avoid", verb: "Overlaps with" },
} as const;

export function StackChip({ signal }: { signal: StackSignal }) {
  const { Icon, tone, verb } = CHIP[signal.kind];
  const names = signal.partners.map((partner) => partner.name).join(", ");

  return (
    <span
      title={`${verb} ${names} on your roster`}
      className={cn("flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-2xs", tone)}
    >
      <Icon className="size-2.5" />
      {shortName(signal.partners[0]?.name ?? "")}
      {signal.partners.length > 1 && `+${signal.partners.length - 1}`}
    </span>
  );
}
