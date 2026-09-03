"""
build_dataset.py — merges the parsed guide with NFL metadata into a typed dataset.

Ranking order, sentiment and tiers all come from the guide and are never
modified here — tiers are read from the yellow rules the author draws between
players on the positional pages.
Team and bye week are joins onto that spine, each carrying provenance so the UI
can flag anything that wasn't verified against a source.

  guide  — stated somewhere in the PDF itself (player cards, dynasty list)
  news   — confirmed against a 2026 transaction report
  boone  — from Justin Boone's published top-300, which lists a club for every
           player; the most complete 2026 source available here
  stated — confirmed by the user directly
  prior  — carried over from the player's 2025 club; NOT verified for 2026

Usage:  python scripts/build_dataset.py extract/guide.json src/lib/data
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

# --- Bye weeks -------------------------------------------------------------
# Source: NFL.com 2026 schedule release. Byes run Week 5-14, none in Week 12.
BYE_WEEKS = {
    5: ["CAR", "KC"],
    6: ["CIN", "DET", "MIA", "MIN"],
    7: ["BUF", "JAX", "LAC", "WAS"],
    8: ["HOU", "NO", "NYG", "SF"],
    9: ["PIT", "TEN"],
    10: ["CHI", "DEN", "PHI", "TB"],
    11: ["ATL", "CLE", "GB", "LAR", "NE", "SEA"],
    13: ["BAL", "IND", "LV", "NYJ"],
    14: ["ARI", "DAL"],
}
BYE_BY_TEAM = {team: week for week, teams in BYE_WEEKS.items() for team in teams}

# --- Names the guide spells two different ways -----------------------------
ALIASES = {
    "bill croskey-merritt": "Jacory Croskey-Merritt",
    "kenneth gainwell": "Kenny Gainwell",
    "mike washington": "Mike Washington Jr.",
    "deebo samuel": "Deebo Samuel Sr.",
    "tyrone tracy jr": "Tyrone Tracy Jr.",
    "chris godwin": "Chris Godwin Jr.",
    "kyle pitts sr": "Kyle Pitts Sr.",
}

# --- Player -> club --------------------------------------------------------
# fmt: off
TEAMS: dict[str, tuple[str, str]] = {
    # Quarterbacks
    "Josh Allen": ("BUF", "boone"), "Lamar Jackson": ("BAL", "boone"),
    "Drake Maye": ("NE", "boone"), "Jayden Daniels": ("WAS", "boone"),
    "Joe Burrow": ("CIN", "boone"), "Jalen Hurts": ("PHI", "boone"),
    "Caleb Williams": ("CHI", "boone"), "Justin Herbert": ("LAC", "boone"),
    "Trevor Lawrence": ("JAX", "boone"), "Jaxson Dart": ("NYG", "boone"),
    "Brock Purdy": ("SF", "boone"), "Dak Prescott": ("DAL", "boone"),
    "Bo Nix": ("DEN", "boone"), "Patrick Mahomes II": ("KC", "boone"),
    "Matthew Stafford": ("LAR", "boone"), "Kyler Murray": ("MIN", "boone"),
    "Jared Goff": ("DET", "boone"), "Malik Willis": ("MIA", "boone"),
    "Tyler Shough": ("NO", "boone"), "Baker Mayfield": ("TB", "boone"),
    "Jordan Love": ("GB", "boone"), "Cam Ward": ("TEN", "boone"),
    "Sam Darnold": ("SEA", "boone"), "Bryce Young": ("CAR", "boone"),
    "Daniel Jones": ("IND", "boone"), "Fernando Mendoza": ("LV", "boone"),
    "C.J. Stroud": ("HOU", "boone"), "Jacoby Brissett": ("ARI", "boone"),
    "Michael Penix Jr.": ("ATL", "boone"), "Aaron Rodgers": ("PIT", "boone"),
    "Geno Smith": ("NYJ", "boone"), "Shedeur Sanders": ("CLE", "boone"),

    # Running backs
    "Jahmyr Gibbs": ("DET", "boone"), "Bijan Robinson": ("ATL", "boone"),
    "Christian McCaffrey": ("SF", "boone"), "Jonathan Taylor": ("IND", "boone"),
    "James Cook III": ("BUF", "boone"), "Omarion Hampton": ("LAC", "boone"),
    "Ashton Jeanty": ("LV", "boone"), "Chase Brown": ("CIN", "boone"),
    "Kenneth Walker III": ("KC", "boone"), "Saquon Barkley": ("PHI", "boone"),
    "De'Von Achane": ("MIA", "boone"), "Derrick Henry": ("BAL", "boone"),
    "Jeremiyah Love": ("ARI", "boone"), "Josh Jacobs": ("GB", "boone"),
    "Breece Hall": ("NYJ", "boone"), "Kyren Williams": ("LAR", "boone"),
    "Javonte Williams": ("DAL", "boone"), "Cam Skattebo": ("NYG", "boone"),
    "Bucky Irving": ("TB", "boone"), "Travis Etienne Jr.": ("NO", "boone"),
    "David Montgomery": ("HOU", "boone"), "Bhayshul Tuten": ("JAX", "boone"),
    "D'Andre Swift": ("CHI", "boone"), "TreVeyon Henderson": ("NE", "boone"),
    "Quinshon Judkins": ("CLE", "boone"), "Chuba Hubbard": ("CAR", "boone"),
    "Jadarian Price": ("SEA", "boone"), "Rhamondre Stevenson": ("NE", "boone"),
    "Jaylen Warren": ("PIT", "boone"), "Rico Dowdle": ("PIT", "boone"),
    "RJ Harvey": ("DEN", "boone"), "Tony Pollard": ("TEN", "boone"),
    "Jonathon Brooks": ("CAR", "boone"), "Blake Corum": ("LAR", "boone"),
    "Kyle Monangai": ("CHI", "boone"), "Rachaad White": ("WAS", "boone"),
    "J.K. Dobbins": ("DEN", "boone"), "Kenny Gainwell": ("TB", "boone"),
    "Jordan Mason": ("MIN", "boone"), "Jacory Croskey-Merritt": ("WAS", "boone"),
    "Zach Charbonnet": ("SEA", "boone"), "Chris Rodriguez Jr.": ("JAX", "boone"),
    "Aaron Jones Sr.": ("MIN", "boone"), "Keaton Mitchell": ("LAC", "boone"),
    "Isiah Pacheco": ("DET", "boone"), "Tank Bigsby": ("PHI", "boone"),
    "Tyler Allgeier": ("ARI", "boone"), "Alvin Kamara": ("NO", "boone"),
    "Ray Davis": ("BUF", "boone"), "Tyrone Tracy Jr.": ("NYG", "boone"),
    "Woody Marks": ("HOU", "boone"), "Tyjae Spears": ("TEN", "boone"),
    "Jonah Coleman": ("DEN", "boone"), "Brian Robinson Jr.": ("ATL", "boone"),
    "Emmett Johnson": ("KC", "boone"), "Dylan Sampson": ("CLE", "boone"),
    "Mike Washington Jr.": ("LV", "boone"), "Jaydon Blue": ("DAL", "prior"),
    "Isaiah Davis": ("NYJ", "boone"), "Ollie Gordon II": ("MIA", "boone"),
    "Braelon Allen": ("NYJ", "boone"), "Marshawn Lloyd": ("GB", "boone"),
    "Jaylen Wright": ("MIA", "boone"), "Kaelon Black": ("SF", "boone"),
    "Malik Davis": ("DAL", "boone"),

    # Wide receivers
    "Ja'Marr Chase": ("CIN", "boone"), "Puka Nacua": ("LAR", "boone"),
    "Amon-Ra St. Brown": ("DET", "boone"), "Jaxon Smith-Njigba": ("SEA", "boone"),
    "CeeDee Lamb": ("DAL", "boone"), "Justin Jefferson": ("MIN", "boone"),
    "Drake London": ("ATL", "boone"), "A.J. Brown": ("NE", "boone"),
    "George Pickens": ("DAL", "boone"), "Rashee Rice": ("KC", "boone"),
    "Nico Collins": ("HOU", "boone"), "DeVonta Smith": ("PHI", "boone"),
    "Malik Nabers": ("NYG", "boone"), "Chris Olave": ("NO", "boone"),
    "Tee Higgins": ("CIN", "boone"), "Jaylen Waddle": ("DEN", "boone"),
    "Zay Flowers": ("BAL", "boone"), "Tetairoa McMillan": ("CAR", "boone"),
    "Emeka Egbuka": ("TB", "boone"), "Luther Burden III": ("CHI", "boone"),
    "Garrett Wilson": ("NYJ", "boone"), "Ladd McConkey": ("LAC", "boone"),
    "DJ Moore": ("BUF", "boone"), "Terry McLaurin": ("WAS", "boone"),
    "Rome Odunze": ("CHI", "boone"), "Davante Adams": ("LAR", "boone"),
    "Christian Watson": ("GB", "boone"), "Mike Evans": ("SF", "boone"),
    "Parker Washington": ("JAX", "boone"), "Jameson Williams": ("DET", "boone"),
    "Carnell Tate": ("TEN", "boone"), "Brian Thomas Jr.": ("JAX", "boone"),
    "Marvin Harrison Jr.": ("ARI", "boone"), "Jordyn Tyson": ("NO", "boone"),
    "Alec Pierce": ("IND", "boone"), "Makai Lemon": ("PHI", "boone"),
    "Michael Wilson": ("ARI", "boone"), "Chris Godwin Jr.": ("TB", "boone"),
    "DK Metcalf": ("PIT", "boone"), "Josh Downs": ("IND", "boone"),
    "Stefon Diggs": ("WAS", "boone"), "Courtland Sutton": ("DEN", "boone"),
    "Deebo Samuel Sr.": ("SF", "boone"), "Quentin Johnston": ("LAC", "boone"),
    "Jordan Addison": ("MIN", "boone"), "Jakobi Meyers": ("JAX", "boone"),
    "Michael Pittman Jr.": ("PIT", "boone"), "Jayden Reed": ("GB", "boone"),
    "Romeo Doubs": ("NE", "boone"), "Matthew Golden": ("GB", "boone"),
    "De'Zhaun Stribling": ("SF", "boone"), "Wan'Dale Robinson": ("TEN", "boone"),
    "Xavier Worthy": ("KC", "boone"), "Jayden Higgins": ("HOU", "prior"),
    "KC Concepcion": ("CLE", "boone"), "Travis Hunter": ("JAX", "boone"),
    "Tre Tucker": ("LV", "boone"), "Jalen Coker": ("CAR", "boone"),
    "Rashid Shaheed": ("SEA", "boone"), "Khalil Shakir": ("BUF", "boone"),
    "Adonai Mitchell": ("NYJ", "boone"), "Denzel Boston": ("CLE", "boone"),
    "Cyrus Allen": ("KC", "boone"),

    # Tight ends
    "Brock Bowers": ("LV", "boone"), "Trey McBride": ("ARI", "boone"),
    "Colston Loveland": ("CHI", "boone"), "Tyler Warren": ("IND", "boone"),
    "Sam LaPorta": ("DET", "boone"), "Harold Fannin Jr.": ("CLE", "boone"),
    "Tucker Kraft": ("GB", "boone"), "Kyle Pitts Sr.": ("ATL", "boone"),
    "George Kittle": ("SF", "boone"), "Dalton Kincaid": ("BUF", "boone"),
    "Dallas Goedert": ("PHI", "boone"), "Mark Andrews": ("BAL", "boone"),
    "Isaiah Likely": ("NYG", "boone"), "Jake Ferguson": ("DAL", "boone"),
    "Travis Kelce": ("KC", "boone"), "Oronde Gadsden II": ("LAC", "boone"),
    "Chig Okonkwo": ("WAS", "boone"), "T.J. Hockenson": ("MIN", "boone"),
    "Kenyon Sadiq": ("NYJ", "boone"), "Greg Dulcich": ("MIA", "boone"),
    "Terrance Ferguson": ("LAR", "boone"), "Juwan Johnson": ("NO", "boone"),
    "Brenton Strange": ("JAX", "boone"), "Hunter Henry": ("NE", "boone"),
    "AJ Barner": ("SEA", "boone"), "Dalton Schultz": ("HOU", "boone"),
    "Colby Parkinson": ("LAR", "boone"), "Cade Otton": ("TB", "boone"),
    "Eli Stowers": ("PHI", "guide"), "Gunnar Helm": ("TEN", "boone"),
    "Pat Freiermuth": ("PIT", "boone"), "Darnell Washington": ("PIT", "prior"),
    "Tyler Higbee": ("LAR", "prior"),
}
# fmt: on


# --- Kickers and defences -------------------------------------------------
# From the guide's kicker and D/ST pages, in its own ADP order. Those two pages
# are images rather than text, so unlike the boards these were read visually and
# should be treated as lower confidence.
KICKERS = [
    ("DAL", "Brandon Aubrey"), ("LAC", "Cameron Dicker"), ("SEA", "Jason Myers"),
    ("HOU", "Ka'imi Fairbairn"), ("JAX", "Cam Little"), ("LAR", "Harrison Mevis"),
    ("DET", "Jake Bates"), ("BAL", "Tyler Loop"), ("KC", "Harrison Butker"),
    ("SF", "Eddie Pineiro"), ("PIT", "Chris Boswell"), ("MIN", "Will Reichard"),
    ("TB", "Chase McLaughlin"), ("CHI", "Cairo Santos"), ("DEN", "Wil Lutz"),
    ("CIN", "Evan McPherson"), ("PHI", "Jake Elliott"), ("NE", "Andres Borregales"),
    ("ATL", "Nick Folk"), ("BUF", "Tyler Bass"), ("GB", "Trey Smack"),
    ("LV", "Matt Gay"), ("IND", "Blake Grupe"), ("NO", "Charlie Smyth"),
    ("MIA", "Riley Patterson"), ("NYG", "Ben Sauls"), ("ARI", "Chad Ryland"),
    ("CAR", "Ryan Fitzgerald"), ("TEN", "Joey Slye"), ("WAS", "Drew Stevens"),
    ("NYJ", "Jason Sanders"), ("CLE", "Andre Szmyt"),
]

DEFENSES = [
    "HOU", "LAR", "DEN", "SEA", "NE", "PHI", "PIT", "MIN",
    "JAX", "BAL", "DET", "LAC", "GB", "DAL", "KC", "SF",
    "BUF", "ATL", "NYG", "CHI", "CLE", "IND", "TB", "NO",
    "WAS", "CAR", "TEN", "CIN", "LV", "MIA", "ARI", "NYJ",
]


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def canonical(name: str) -> str:
    return ALIASES.get(name.lower(), name)


def main() -> None:
    guide = json.loads(Path(sys.argv[1]).read_text())
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    players: dict[str, dict] = {}

    def upsert(name: str, position: str, sentiment: str) -> dict:
        name = canonical(name)
        player = players.setdefault(
            name,
            {
                "id": slugify(name),
                "name": name,
                "position": position,
                "sentiment": sentiment,
                "ranks": {},
            },
        )
        # A sentiment stated on the big board wins over a neutral elsewhere.
        if player["sentiment"] == "neutral" and sentiment != "neutral":
            player["sentiment"] = sentiment
        return player

    for fmt in ("ppr", "half"):
        for row in guide[fmt]["board"]:
            player = upsert(row["name"], row["position"], row["sentiment"])
            player["ranks"].setdefault(fmt, {})["overall"] = row["overallRank"]
        for position, group in guide[fmt]["positional"].items():
            for row in group:
                player = upsert(row["name"], position, row["sentiment"])
                ranks = player["ranks"].setdefault(fmt, {})
                ranks["position"] = row["positionRank"]
                ranks["tier"] = row["tier"]

    unmapped = []
    for player in players.values():
        team, source = TEAMS.get(player["name"], (None, "unknown"))
        player["team"] = team
        player["teamSource"] = source
        player["byeWeek"] = BYE_BY_TEAM.get(team) if team else None
        if source in ("unknown",):
            unmapped.append(player["name"])

    # --- Cross-format carry-over -------------------------------------------
    # The guide caps each positional list (WR 60, TE 32) and the two boards do
    # not always agree on who takes the final slot, so a handful of players are
    # ranked in one format and absent from the other. Left alone they vanish
    # from the board when the format is switched, which reads as a bug rather
    # than as the guide running out of room. Each is appended to the end of his
    # position in the format that omits him, in the last tier, and flagged.
    carried = []
    for fmt in ("ppr", "half"):
        other = "half" if fmt == "ppr" else "ppr"

        bounds = {}
        for player in players.values():
            ranks = player["ranks"].get(fmt)
            if not ranks:
                continue
            position = player["position"]
            last = bounds.setdefault(position, {"position": 0, "tier": 1})
            last["position"] = max(last["position"], ranks["position"])
            last["tier"] = max(last["tier"], ranks["tier"])

        missing = [
            player
            for player in players.values()
            if fmt not in player["ranks"] and other in player["ranks"]
        ]
        missing.sort(key=lambda p: p["ranks"][other]["position"])

        for player in missing:
            last = bounds.setdefault(player["position"], {"position": 0, "tier": 1})
            last["position"] += 1
            player["ranks"][fmt] = {
                "position": last["position"],
                "tier": last["tier"],
                # No overall rank: the guide's 150 is untouched by this.
                "carried": True,
            }
            carried.append(f"{player['name']} -> {fmt} {player['position']}{last['position']}")

    # Kickers and defences carry a positional rank from the guide's ADP order
    # and no overall rank, so they stay out of the 150-player board.
    for index, (team, name) in enumerate(KICKERS, start=1):
        players[name] = {
            "id": slugify(name), "name": name, "position": "K",
            "sentiment": "neutral", "team": team, "teamSource": "guide",
            "byeWeek": BYE_BY_TEAM.get(team),
            "ranks": {fmt: {"position": index, "tier": 1} for fmt in ("ppr", "half")},
        }

    for index, team in enumerate(DEFENSES, start=1):
        name = f"{team} D/ST"
        players[name] = {
            "id": slugify(name), "name": name, "position": "DST",
            "sentiment": "neutral", "team": team, "teamSource": "guide",
            "byeWeek": BYE_BY_TEAM.get(team),
            "ranks": {fmt: {"position": index, "tier": 1} for fmt in ("ppr", "half")},
        }

    ordered = sorted(
        players.values(),
        key=lambda p: (
            p["ranks"].get("ppr", {}).get("overall", 999),
            p["ranks"].get("ppr", {}).get("position", 999),
        ),
    )

    (out_dir / "players.json").write_text(json.dumps(ordered, indent=1))

    sources = Counter(p["teamSource"] for p in ordered)
    tiers = {
        fmt: {
            pos: max(
                (p["ranks"][fmt]["tier"] for p in ordered
                 if p["position"] == pos and "tier" in p["ranks"].get(fmt, {})),
                default=0,
            )
            for pos in ("QB", "RB", "WR", "TE")
        }
        for fmt in ("ppr", "half")
    }

    print(f"  players      {len(ordered)}")
    print(f"  team source  {dict(sources)}")
    print(f"  tier counts  {tiers}")
    print(f"  sentiment    {dict(Counter(p['sentiment'] for p in ordered))}")
    if carried:
        print(f"  carried      {len(carried)}: {'; '.join(carried)}")
    if unmapped:
        print(f"  NEEDS TEAM   {unmapped}")


if __name__ == "__main__":
    main()
