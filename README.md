# Draftaid

A live fantasy football draft companion.

The built-in rankings are parsed from a source draft-guide PDF — order, tiers
and target/pass/avoid marks are all read out of the file, and nothing in the app
reorders them. On top of that you can build your own ranking sets and draft off
those instead.

## Run it

```bash
npm install
npm run dev
```

Next.js 14 · React 18 · TypeScript (strict) · Tailwind · Framer Motion · Lucide ·
dnd-kit (drag and drop in the rankings editor).
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
| `⌘K` / `/` | Draft by name or club |
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

- **Default Rankings (PPR / Half PPR)** — the built-in data, immutable. There is
  no writable representation of it anywhere in the app.
- **Custom sets** — yours. Every one starts as a full copy of a default board:
  overall order, all four tier ladders, and existing marks. You adjust an
  existing ranking rather than authoring one from nothing.

Pick one from the rankings menu in the header. Switching is instant and touches
nothing about the draft: picks, seats, rosters and league settings live under a
different storage key and share no code path with rankings.

### Three independent pieces

A custom set holds three things that deliberately do not control each other:

| | What it is | Where it is edited |
|---|---|---|
| **Positional tiers** | How a player rates against others at his own position | Position tabs, tier board |
| **Overall ranking** | Draft order, 1..N, no tiers | Overall tab |
| **Designations** | Target / Pass / Avoid | Either tab, on the card |

Moving a QB from tier 1 to tier 3 does **not** change his overall rank, and
moving him to #2 overall does **not** change his tier. A QB in positional tier 1
sitting 40th overall is a legitimate opinion the model has to be able to hold.

**Overall ranking is the draft authority.** "Who is the best available player?"
is answered from the overall list. Positional tiers supply context — tier
labels, position columns, tier breaks — and never override the explicit order.

### Building an overall ranking from tiers

Tier boards are the fast way in. Sorting four short position lists is quick;
ranking 150 players by hand is not, so the tier boards generate the overall
list: every position's tier 1 first, then every position's tier 2, and so on.
Within one depth the positions run QB, RB, WR, TE, and each tier keeps the order
you arranged inside it. Players you never tiered are appended in the default
order — kickers and defences land there too, since they are never tiered.

The generated list is then yours. While it still matches what generation
produced, further tier edits refresh it automatically. The moment you reorder it
by hand it stops following, marks itself "edited by hand", and only **Rebuild
from tiers** will replace it — which asks first.

### The editor

Position tabs are a tier board: drag cards between tiers, reorder inside a tier,
drag to the pool to unrank, drag back to re-rank. The whole tier row is a drop
target, and the tier under the cursor highlights. Tiers can be added, renamed,
reordered, emptied and deleted; deleting one returns its players to the pool.
The Overall tab is a flat drag list where rank is read off list position.

T / P / A buttons on any card set a designation in one click and clear it on a
second. They are mutually exclusive by construction — one key per player — so
marking a target as avoid simply overwrites.

**Clear all** empties every tier at the position on screen and returns those
players to the pool, leaving the tier rows in place and the other three
positions untouched. It confirms first.

Search and the status filter **dim** players rather than removing them, so a
filtered view can never silently change what a tier contains.

Edits autosave, with undo.

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
