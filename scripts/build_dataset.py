"""
build_dataset.py — merges the parsed guide with NFL metadata into a typed dataset.

Ranking order, sentiment and tiers all come from the guide and are never
modified here — tiers are read from the yellow rules the author draws between
players on the positional pages.
Team and bye week are joins onto that spine, each carrying provenance so the UI
can flag anything that wasn't verified against a source.

  guide  — stated somewhere in the PDF itself (player cards, dynasty list)
  news   — confirmed against a 2026 transaction report
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
}

# --- Player -> club --------------------------------------------------------
# fmt: off
TEAMS: dict[str, tuple[str, str]] = {
    # Quarterbacks
    "Josh Allen": ("BUF", "prior"), "Lamar Jackson": ("BAL", "guide"),
    "Drake Maye": ("NE", "guide"), "Jayden Daniels": ("WAS", "prior"),
    "Joe Burrow": ("CIN", "prior"), "Jalen Hurts": ("PHI", "prior"),
    "Caleb Williams": ("CHI", "guide"), "Justin Herbert": ("LAC", "prior"),
    "Trevor Lawrence": ("JAX", "guide"), "Jaxson Dart": ("NYG", "prior"),
    "Brock Purdy": ("SF", "prior"), "Dak Prescott": ("DAL", "prior"),
    "Bo Nix": ("DEN", "prior"), "Patrick Mahomes II": ("KC", "guide"),
    "Matthew Stafford": ("LAR", "prior"), "Kyler Murray": ("MIN", "guide"),
    "Jared Goff": ("DET", "prior"), "Malik Willis": ("MIA", "news"),
    "Tyler Shough": ("NO", "prior"), "Baker Mayfield": ("TB", "prior"),
    "Jordan Love": ("GB", "prior"), "Cam Ward": ("TEN", "prior"),
    "Sam Darnold": ("SEA", "prior"), "Bryce Young": ("CAR", "prior"),
    "Daniel Jones": ("IND", "prior"), "Fernando Mendoza": ("LV", "guide"),
    "C.J. Stroud": ("HOU", "prior"), "Jacoby Brissett": ("ARI", "guide"),
    "Michael Penix Jr.": ("ATL", "news"), "Aaron Rodgers": ("PIT", "news"),
    "Geno Smith": ("NYJ", "news"), "Shedeur Sanders": ("CLE", "prior"),

    # Running backs
    "Jahmyr Gibbs": ("DET", "prior"), "Bijan Robinson": ("ATL", "prior"),
    "Christian McCaffrey": ("SF", "prior"), "Jonathan Taylor": ("IND", "prior"),
    "James Cook III": ("BUF", "prior"), "Omarion Hampton": ("LAC", "guide"),
    "Ashton Jeanty": ("LV", "guide"), "Chase Brown": ("CIN", "prior"),
    "Kenneth Walker III": ("KC", "guide"), "Saquon Barkley": ("PHI", "prior"),
    "De'Von Achane": ("MIA", "prior"), "Derrick Henry": ("BAL", "prior"),
    "Jeremiyah Love": ("ARI", "guide"), "Josh Jacobs": ("GB", "prior"),
    "Breece Hall": ("NYJ", "prior"), "Kyren Williams": ("LAR", "prior"),
    "Javonte Williams": ("DAL", "prior"), "Cam Skattebo": ("NYG", "prior"),
    "Bucky Irving": ("TB", "prior"), "Travis Etienne Jr.": ("NO", "news"),
    "David Montgomery": ("HOU", "news"), "Bhayshul Tuten": ("JAX", "prior"),
    "D'Andre Swift": ("CHI", "prior"), "TreVeyon Henderson": ("NE", "prior"),
    "Quinshon Judkins": ("CLE", "prior"), "Chuba Hubbard": ("CAR", "prior"),
    "Jadarian Price": ("SEA", "guide"), "Rhamondre Stevenson": ("NE", "prior"),
    "Jaylen Warren": ("PIT", "guide"), "Rico Dowdle": ("PIT", "news"),
    "RJ Harvey": ("DEN", "prior"), "Tony Pollard": ("TEN", "prior"),
    "Jonathon Brooks": ("CAR", "guide"), "Blake Corum": ("LAR", "prior"),
    "Kyle Monangai": ("CHI", "prior"), "Rachaad White": ("TB", "prior"),
    "J.K. Dobbins": ("DEN", "prior"), "Kenny Gainwell": ("TB", "news"),
    "Jordan Mason": ("MIN", "prior"), "Jacory Croskey-Merritt": ("WAS", "prior"),
    "Zach Charbonnet": ("SEA", "prior"), "Chris Rodriguez Jr.": ("WAS", "prior"),
    "Aaron Jones Sr.": ("MIN", "prior"), "Keaton Mitchell": ("BAL", "prior"),
    "Isiah Pacheco": ("DET", "news"), "Tank Bigsby": ("PHI", "prior"),
    "Tyler Allgeier": ("ARI", "news"), "Alvin Kamara": ("NO", "prior"),
    "Ray Davis": ("BUF", "prior"), "Tyrone Tracy Jr.": ("NYG", "prior"),
    "Woody Marks": ("HOU", "prior"), "Tyjae Spears": ("TEN", "prior"),
    "Jonah Coleman": ("DEN", "guide"), "Brian Robinson Jr.": ("ATL", "news"),
    "Emmett Johnson": ("KC", "guide"), "Dylan Sampson": ("CLE", "prior"),
    "Mike Washington Jr.": ("LV", "guide"), "Jaydon Blue": ("DAL", "prior"),
    "Isaiah Davis": ("NYJ", "prior"), "Ollie Gordon II": ("MIA", "prior"),

    # Wide receivers
    "Ja'Marr Chase": ("CIN", "guide"), "Puka Nacua": ("LAR", "prior"),
    "Amon-Ra St. Brown": ("DET", "prior"), "Jaxon Smith-Njigba": ("SEA", "news"),
    "CeeDee Lamb": ("DAL", "prior"), "Justin Jefferson": ("MIN", "prior"),
    "Drake London": ("ATL", "prior"), "A.J. Brown": ("NE", "guide"),
    "George Pickens": ("DAL", "prior"), "Rashee Rice": ("KC", "prior"),
    "Nico Collins": ("HOU", "prior"), "DeVonta Smith": ("PHI", "prior"),
    "Malik Nabers": ("NYG", "prior"), "Chris Olave": ("NO", "prior"),
    "Tee Higgins": ("CIN", "guide"), "Jaylen Waddle": ("DEN", "news"),
    "Zay Flowers": ("BAL", "guide"), "Tetairoa McMillan": ("CAR", "prior"),
    "Emeka Egbuka": ("TB", "guide"), "Luther Burden III": ("CHI", "guide"),
    "Garrett Wilson": ("NYJ", "prior"), "Ladd McConkey": ("LAC", "prior"),
    "DJ Moore": ("BUF", "news"), "Terry McLaurin": ("WAS", "prior"),
    "Rome Odunze": ("CHI", "prior"), "Davante Adams": ("LAR", "prior"),
    "Christian Watson": ("GB", "prior"), "Mike Evans": ("SF", "news"),
    "Parker Washington": ("JAX", "guide"), "Jameson Williams": ("DET", "prior"),
    "Carnell Tate": ("TEN", "guide"), "Brian Thomas Jr.": ("JAX", "guide"),
    "Marvin Harrison Jr.": ("ARI", "guide"), "Jordyn Tyson": ("NO", "guide"),
    "Alec Pierce": ("IND", "prior"), "Makai Lemon": ("PHI", "guide"),
    "Michael Wilson": ("ARI", "prior"), "Chris Godwin Jr.": ("TB", "prior"),
    "DK Metcalf": ("PIT", "prior"), "Josh Downs": ("IND", "prior"),
    "Stefon Diggs": ("WAS", "stated"), "Courtland Sutton": ("DEN", "guide"),
    "Deebo Samuel Sr.": ("WAS", "prior"), "Quentin Johnston": ("LAC", "prior"),
    "Jordan Addison": ("MIN", "prior"), "Jakobi Meyers": ("JAX", "guide"),
    "Michael Pittman Jr.": ("PIT", "news"), "Jayden Reed": ("GB", "prior"),
    "Romeo Doubs": ("NE", "news"), "Matthew Golden": ("GB", "prior"),
    "De'Zhaun Stribling": ("SF", "guide"), "Wan'Dale Robinson": ("TEN", "news"),
    "Xavier Worthy": ("KC", "prior"), "Jayden Higgins": ("HOU", "prior"),
    "KC Concepcion": ("CLE", "guide"), "Travis Hunter": ("JAX", "guide"),
    "Tre Tucker": ("LV", "prior"), "Jalen Coker": ("CAR", "prior"),
    "Rashid Shaheed": ("SEA", "prior"), "Khalil Shakir": ("BUF", "prior"),
    "Adonai Mitchell": ("IND", "prior"),

    # Tight ends
    "Brock Bowers": ("LV", "guide"), "Trey McBride": ("ARI", "prior"),
    "Colston Loveland": ("CHI", "prior"), "Tyler Warren": ("IND", "guide"),
    "Sam LaPorta": ("DET", "prior"), "Harold Fannin Jr.": ("CLE", "guide"),
    "Tucker Kraft": ("GB", "prior"), "Kyle Pitts Sr.": ("ATL", "prior"),
    "George Kittle": ("SF", "prior"), "Dalton Kincaid": ("BUF", "prior"),
    "Dallas Goedert": ("PHI", "prior"), "Mark Andrews": ("BAL", "guide"),
    "Isaiah Likely": ("NYG", "news"), "Jake Ferguson": ("DAL", "guide"),
    "Travis Kelce": ("KC", "guide"), "Oronde Gadsden II": ("LAC", "prior"),
    "Chig Okonkwo": ("WAS", "news"), "T.J. Hockenson": ("MIN", "prior"),
    "Kenyon Sadiq": ("NYJ", "guide"), "Greg Dulcich": ("NYG", "prior"),
    "Terrance Ferguson": ("LAR", "prior"), "Juwan Johnson": ("NO", "guide"),
    "Brenton Strange": ("JAX", "prior"), "Hunter Henry": ("NE", "prior"),
    "AJ Barner": ("SEA", "prior"), "Dalton Schultz": ("HOU", "guide"),
    "Colby Parkinson": ("LAR", "prior"), "Cade Otton": ("TB", "prior"),
    "Eli Stowers": ("PHI", "guide"), "Gunnar Helm": ("TEN", "prior"),
    "Pat Freiermuth": ("PIT", "prior"), "Darnell Washington": ("PIT", "prior"),
    "Tyler Higbee": ("LAR", "prior"),
}
# fmt: on


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
    if unmapped:
        print(f"  NEEDS TEAM   {unmapped}")


if __name__ == "__main__":
    main()
