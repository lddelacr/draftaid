# Data report

The built-in rankings come from the source draft-guide PDF. Team and
bye week are joined onto that spine from outside sources and carry provenance so
nothing unverified is presented as fact.

## Extracted from the guide (exact)

Parsed from the PDF text layer, not OCR, and verified on every run.

| Dataset | Result |
|---|---|
| PPR big board | 150 / 150, no gaps |
| Half-PPR big board | 150 / 150, no gaps |
| Positional rankings, PPR | QB 32, RB 60, WR 60, TE 32 |
| Positional rankings, half-PPR | QB 32, RB 60, WR 60, TE 32 |
| Unique players | 186 (150 ranked overall + 36 depth-only) |
| Kickers / defences | 32 + 32, from the guide's ADP tables |
| Sentiment tags | 31 target, 15 pass, 11 avoid, 129 untagged |

Both boards contain the identical set of 150 players in different orders, which
is a useful internal consistency check — the parse would otherwise be suspect.

`scripts/parse_guide.py` raises on any missing rank rather than shipping a board
with holes, so a re-run against a revised guide either succeeds completely or
fails loudly.

## Tiers — read from the guide, not derived

The guide marks tiers with thin yellow rules drawn between players on the
positional pages. Those are the author's own tier breaks, so the parser reads
the rule positions directly and assigns tier membership from them. Nothing is
inferred from rank gaps.

| | QB | RB | WR | TE |
|---|---|---|---|---|
| PPR | 7 | 11 | 11 | 8 |
| Half | 7 | 11 | 11 | 8 |

PPR running back bands, as drawn: **1-2**, **3-5**, 6-10, 11-14, 15-20, 21-25,
26-30, 31-36, 37-43, 44-48, 49-60. The two boards differ where you would expect
them to — half-PPR RB tier 2 is 3-4 rather than 3-5, moving James Cook III down a
tier.

**Sentiment** is preserved separately from tiers, as agreed — target / pass /
avoid render as a badge, tiers as the row banding.

## Joined from outside the guide

**Bye weeks** — complete, from the NFL.com 2026 schedule release. Byes run Weeks
5–14 with none in Week 12; six teams are off in Week 11.

**NFL teams** — 186 players, every one assigned except Stefon Diggs:

| Source | Count | Meaning |
|---|---|---|
| `guide` | 45 | Stated in the PDF (player cards, dynasty list, stat notes) |
| `stated` | 2 | Confirmed directly (Stefon Diggs → WAS, Deebo Samuel Sr. → SF) |
| `news` | 20 | Confirmed against 2026 transaction reporting |
| `prior` | 119 | Carried from the player's 2025 club — **not verified for 2026** |
| `unknown` | 1 | Stefon Diggs |

The `prior` bucket is the honest weak spot. Those 120 are almost certainly right,
because most players don't move, but I haven't confirmed each one against a 2026
roster. The UI will mark them so a wrong club is visible rather than silent.

**Needs your input:** Stefon Diggs left New England this offseason and I couldn't
confirm where he landed. He's WR41 (PPR) in the guide, so he does matter. Tell me
his team and I'll set it.

**Verified 2026 moves already applied** (these are the ones that would have been
wrong if I'd used my own assumptions): A.J. Brown → NE, Kenneth Walker III → KC,
Kyler Murray → MIN, Jaylen Waddle → DEN, DJ Moore → BUF, Mike Evans → SF, Michael
Pittman Jr. → PIT, David Montgomery → HOU, Travis Etienne Jr. → NO, Rico Dowdle →
PIT, Isiah Pacheco → DET, Tyler Allgeier → ARI, Kenny Gainwell → TB, Romeo Doubs
→ NE, Wan'Dale Robinson → TEN, Isaiah Likely → NYG, Chig Okonkwo → WAS, Malik
Willis → MIA, Geno Smith → NYJ, Michael Penix Jr. → ATL, Aaron Rodgers → PIT,
Brian Robinson Jr. → ATL.

## Name normalisation

The guide spells three players two ways across its pages. Aliased to one record:

- Bill Croskey-Merritt → **Jacory Croskey-Merritt**
- Kenneth Gainwell → **Kenny Gainwell**
- Mike Washington → **Mike Washington Jr.**

No other names were ambiguous — nothing needs your verification here.

## Kickers and defences

Both are in, in the guide's own ADP order, carrying a positional rank and no
overall rank — so they never appear inside the 150. They sit at the bottom of
the overall board as D1-D32 and K1-K32.

**These two pages are images, not text.** Unlike the boards, they were read
visually rather than parsed, so treat them as lower confidence and spot-check
anything that looks off.

## Not yet ingested

Parked until you want them: '25 adjusted PPG with context notes, the luck
metric, dynasty rookie rankings, and the OL / playcaller tables. All image pages
with the same confidence caveat.
