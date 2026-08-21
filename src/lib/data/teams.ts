import type { NflTeam } from "@/types";

/**
 * Search aliases for NFL clubs.
 *
 * Defences are stored as "LAR D/ST", which is unfindable if you think of them
 * as the Rams. Every club therefore carries its city, nickname and common
 * shorthand, so "rams", "los angeles rams" and "lar" all reach the same entry.
 * This also improves ordinary player search — typing "niners" finds the whole
 * San Francisco roster.
 */
export const TEAM_ALIASES: Record<NflTeam, readonly string[]> = {
  ARI: ["arizona", "cardinals", "cards"],
  ATL: ["atlanta", "falcons"],
  BAL: ["baltimore", "ravens"],
  BUF: ["buffalo", "bills"],
  CAR: ["carolina", "panthers"],
  CHI: ["chicago", "bears"],
  CIN: ["cincinnati", "bengals"],
  CLE: ["cleveland", "browns"],
  DAL: ["dallas", "cowboys"],
  DEN: ["denver", "broncos"],
  DET: ["detroit", "lions"],
  GB: ["green bay", "packers", "gb"],
  HOU: ["houston", "texans"],
  IND: ["indianapolis", "colts"],
  JAX: ["jacksonville", "jaguars", "jags"],
  KC: ["kansas city", "chiefs", "kc"],
  LAC: ["los angeles chargers", "chargers", "bolts"],
  LAR: ["los angeles rams", "rams"],
  LV: ["las vegas", "raiders"],
  MIA: ["miami", "dolphins", "fins"],
  MIN: ["minnesota", "vikings", "vikes"],
  NE: ["new england", "patriots", "pats"],
  NO: ["new orleans", "saints"],
  NYG: ["new york giants", "giants"],
  NYJ: ["new york jets", "jets"],
  PHI: ["philadelphia", "eagles", "philly"],
  PIT: ["pittsburgh", "steelers"],
  SEA: ["seattle", "seahawks", "hawks"],
  SF: ["san francisco", "49ers", "niners"],
  TB: ["tampa bay", "buccaneers", "bucs"],
  TEN: ["tennessee", "titans"],
  WAS: ["washington", "commanders", "commies"],
};

/** True when the query names this club by code, city or nickname. */
export function teamMatches(team: NflTeam | null, query: string): boolean {
  if (!team) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  if (team.toLowerCase().startsWith(needle)) return true;
  return TEAM_ALIASES[team].some((alias) => alias.includes(needle));
}
