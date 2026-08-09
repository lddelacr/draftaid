import { cn } from "@/lib/utils";

/** Panel chrome shared by all three columns, so they stay visually siblings. */

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count?: number;
  /** Optional colour chip, used by the position columns. */
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-2 px-2.5 py-2">
      {accent && <span className={cn("size-1.5 rounded-full", accent)} />}
      <h2 className="text-2xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      {count !== undefined && <span className="tnum text-2xs text-dim">{count}</span>}
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </header>
  );
}

export function PanelBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-1", className)}>{children}</div>
  );
}
