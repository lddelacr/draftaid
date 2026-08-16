# Draftaid

A live fantasy football draft companion built on **Joel Smyth's Draft Guide 2026**.
The guide is the only ranking source — order, tiers and target/pass/avoid marks
are all read out of the PDF, and nothing in the app reorders them.

## Run it

```bash
npm install
npm run dev
```

Next.js 14 · React 18 · TypeScript (strict) · Tailwind · Framer Motion · Lucide.
`components.json` is configured, so `npx shadcn@latest add <component>` works.

## Rebuild the data

```bash
python scripts/parse_guide.py path/to/guide.pdf extract
python scripts/build_dataset.py extract/guide.json src/lib/data
```

Requires `pdfplumber`. The parser asserts all 150 ranks and all four positional
lists on every run and exits non-zero rather than shipping a board with holes.
See `DATA_REPORT.md` for provenance.

## Keyboard

| Key | Action |
|---|---|
| `⌘K` / `/` | Draft by name |
| `↑` `↓` `⏎` | Move and commit in the palette |
| `⌘Z` | Undo last pick |
| `Esc` | Close palette or settings |

## Layout

Three panes: the guide's top 150 on the left, best available by position in the
middle, your lineup and the draft log on the right. Light by default, with a
dark toggle in the header.

The overall board scrolls; the four position columns show a fixed slice and end
in white space so the middle pane stays readable at a glance. Each column header
carries the true remaining count, and anyone past the slice is a search away on
the left.

Kickers and defences sit at the bottom of the overall board with their own
D1-D32 and K1-K32 ordering. They carry no overall rank, so they never displace
anyone inside the guide's 150.

Roster slots are league-wide and editable from any team's card. Changing them
adjusts the lineup and round count without touching the picks already made.

League setup — scoring format, number of teams, your seat — sits in the header
rather than behind a dialog. Roster slots are edited from the My team card, and
round count follows roster size automatically.

Four players are ranked in only one format (Adonai Mitchell and Tyler Higbee in
half-PPR, Darnell Washington and Khalil Shakir in PPR). They appear only in the
format that ranks them.

## Deploying

The app is entirely client-side, so it can ship either way:

- **Vercel** — push the repo, import it, done. No config needed.
- **Static files** — add `output: "export"` to `next.config.mjs` and run
  `npm run build`. The whole app lands in `out/` at under 1 MB and can be
  dropped on any static host, including GitHub Pages. Set `basePath` if it
  lives in a subdirectory rather than at the domain root.

## Ranking sets

The board evaluates against an active **ranking book**. Two kinds exist:

- **Default Guide (PPR / Half PPR)** — the built-in data, immutable. There is no
  writable representation of it anywhere in the app.
- **Custom sets** — yours, created by cloning a guide board and editing it.

Pick one from the rankings menu in the header. Switching is instant and touches
nothing about the draft: picks, seats, rosters and league settings are stored
separately and share no code path with rankings.

Everything ranking-derived follows the active book — board order, tiers, tier
names, target/pass/avoid, vs-rank, value flags, position columns and the command
palette.

Scoring format rides on the ranking source rather than being a separate control,
so the board on screen can never disagree with the format setting.

### The editor

Drag a row to move a player; the dropped player adopts the tier they land in.
Alt+↑ / Alt+↓ nudge by one, and T / P / A toggle a designation on the focused
row. Scissors starts a new tier at that player; "Merge up" folds a tier into the
one above. Tiers can be named. Edits save as you make them, with undo.

Drag is disabled while a search or position filter is active, since dropping
into a filtered list has no unambiguous meaning.

## My team

A dropdown in the card header switches the lineup view to any seat in the
league, each option showing that roster's net value, so the picker doubles as a
league-wide scoreboard. Each player carries a `vs rk` figure — picks past the guide's rank, so
positive means value — and the header totals it for the roster.

Roster slot editing only appears on your own team.

## Correcting a draft

Clicking any row in the Drafted list removes that pick and renumbers everything
after it. Undo (`⌘Z`) only unwinds the most recent pick, which is no help once a
mis-entry is buried; this handles the case where you notice ten picks later.

The `vs rank` column header sorts the list by value — best steals first, then
click again for the worst reaches. Click `Pick` to go back to draft order.

## Stacks

Once you own a player, everyone from that club is annotated on both lists:

- **Link chip, green** — stacks with someone you hold. QB with WR or TE, either
  direction.
- **Shield chip, green** — handcuffs someone you hold. Two backs on one offence
  split the same carries, and owning both means the touches land on your roster
  whichever way the job breaks.
- **Team code tinted red** — overlaps with someone you hold. Any two pass
  catchers on one offence, and a back against a QB or pass catcher on that
  offence. Hovering the club says who and why.

Negative correlation deliberately has no chip: a red badge carrying a name
competed with the player's own name for the row, and the club is what the
warning is actually about. All three states explain themselves on hover.

Both can appear at once: taking Shakir while holding Allen and Cook is a stack
and an overlap in the same row. Colour is the secondary cue — the icons carry
the meaning, because the guide already uses green and red for target and avoid
on the same line.

## Architecture

Business logic is framework-free and lives under `src/lib`:

- `lib/draft/snake.ts` — pick order maths. Seat and round are derived from pick
  number, never stored.
- `lib/draft/reducer.ts` — the draft is an append-only list of picks, so undo is
  a pop and nothing can drift out of sync.
- `lib/draft/selectors.ts` — read models: availability, rosters, tier runway,
  positional runs, value drop.
- `lib/scoring/formats.ts` — lineup shapes, superflex included.
- `lib/scoring/lineup.ts` — fills drafted players into named starting slots.
- `lib/draft/stacks.ts` — QB/pass-catcher correlation against your roster.

`src/components` renders those; it holds no draft rules of its own.
