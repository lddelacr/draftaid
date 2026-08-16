"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft } from "lucide-react";
import type { Player } from "@/types";
import type { RankingBook } from "@/lib/rankings/book";
import { cn } from "@/lib/utils";
import { matches } from "@/hooks/useFilteredPlayers";
import { POSITION_STYLES, SENTIMENT_DOT } from "@/lib/presentation";

interface CommandPaletteProps {
  open: boolean;
  players: readonly Player[];
  book: RankingBook;
  onClose: () => void;
  onDraft: (player: Player) => void;
}

/**
 * Type three letters, press Enter, the pick is in. The single biggest speed win
 * over clicking a row: during a live draft the clock is the constraint, not the
 * information.
 */
export function CommandPalette({
  open,
  players,
  book,
  onClose,
  onDraft,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => players.filter((player) => matches(player, query)).slice(0, 8),
    [players, query],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  if (!open) return null;

  const commit = (player: Player | undefined) => {
    if (!player) return;
    onDraft(player);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-body/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-label="Draft a player"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "mx-auto mt-[12vh] w-[min(34rem,calc(100vw-2rem))] overflow-hidden",
            "rounded-xl border border-line bg-panel shadow-xl shadow-black/10 dark:shadow-black/50",
          )}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                commit(results[cursor]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Draft a player…"
            className="w-full bg-transparent px-4 py-3.5 text-base text-body placeholder:text-dim focus:outline-none"
          />

          <div className="border-t border-line">
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-dim">
                Nobody left matching that.
              </p>
            ) : (
              results.map((player, index) => (
                <button
                  key={player.id}
                  type="button"
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => commit(player)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                    index === cursor ? "bg-sunken" : "bg-transparent",
                  )}
                >
                  <span className="tnum w-8 text-right text-sm text-muted">
                    {book.entry(player.id)?.overall ?? "—"}
                  </span>
                  <span
                    className={cn(
                      "tnum w-9 rounded px-1 py-0.5 text-center text-2xs ring-1 ring-inset",
                      POSITION_STYLES[player.position],
                    )}
                  >
                    {player.position}
                    {book.entry(player.id)?.position}
                  </span>
                  {(book.entry(player.id)?.sentiment ?? "neutral") !== "neutral" && (
                    <span
                      className={cn("size-1.5 rounded-full", SENTIMENT_DOT[book.entry(player.id)?.sentiment ?? "neutral"])}
                    />
                  )}
                  <span className="flex-1 truncate text-sm text-body">{player.name}</span>
                  <span className="tnum text-2xs text-dim">
                    {player.team ?? "—"}
                    {player.byeWeek ? ` · B${player.byeWeek}` : ""}
                  </span>
                  {index === cursor && <CornerDownLeft className="size-3.5 text-dim" />}
                </button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
