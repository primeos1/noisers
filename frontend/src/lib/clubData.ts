// Sample content for the frontend build-out. Every record here is shaped
// exactly like the data the Laravel API will return later, so swapping
// this file for a fetch() call is the only change needed once the
// backend is live.

export type Position = "GK" | "DEF" | "MID" | "FWD";

/** A full club member, or a guest member who plays with the squad. */
export type Membership = "member" | "guest";

export const membershipLabels: Record<Membership, string> = {
  member: "Member",
  guest: "Guest member",
};

export interface Player {
  /** Database id — the player's identity. Shirt numbers can repeat. */
  id: number;
  number: number;
  name: string;
  position: Position;
  /** Optional second position; the main one drives team balancing and ratings. */
  secondaryPosition?: Position | null;
  membership: Membership;
  photo: string;
  /** A line or two the player writes about themselves (from the API only). */
  bio?: string | null;
  rating: number;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** Only keepers make saves — see isKeeper(). */
  saves: number;
  yellowCards: number;
  redCards: number;
  /** Times named player of the week / picked in the team of the week (from the API only). */
  playerOfTheWeekWins?: number;
  teamOfTheWeekSelections?: number;
  /** Rating before/after each match day, oldest first (from the API only). */
  ratingHistory?: RatingPoint[];
}

export interface RatingPoint {
  eventId: string;
  before: number;
  after: number;
}

function avatar(id: number) {
  return `https://i.pravatar.cc/400?img=${id}`;
}

/** Random stock face shown for a player until a real photo is uploaded. */
export function stockPhoto(number: number) {
  return avatar((number % 70) + 1);
}

/** True for the stock faces above — never saved as the player's photo. */
export function isStockPhoto(url: string) {
  return url.includes("pravatar.cc");
}

export function findPlayer(players: Player[], id: number): Player {
  const player = players.find((p) => p.id === id);
  if (!player) throw new Error(`Unknown player ${id}`);
  return player;
}

export const positionLabels: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

/** Forwards don't keep clean sheets; the main position decides, as for ratings. */
export function keepsCleanSheets(player: Pick<Player, "position">): boolean {
  return player.position !== "FWD";
}

/** Keepers by main or second position — the only players saves are logged for. */
export function isKeeper(player: Pick<Player, "position" | "secondaryPosition">): boolean {
  return player.position === "GK" || player.secondaryPosition === "GK";
}

/** "MID / FWD" — the main position, then the second if there is one. */
export function positionCodes(player: Pick<Player, "position" | "secondaryPosition">): string {
  return player.secondaryPosition ? `${player.position} / ${player.secondaryPosition}` : player.position;
}

/** "Midfielder / Forward" */
export function positionNames(player: Pick<Player, "position" | "secondaryPosition">): string {
  const main = positionLabels[player.position];
  return player.secondaryPosition ? `${main} / ${positionLabels[player.secondaryPosition]}` : main;
}

export function nextJerseyNumber(players: Player[]): number {
  const taken = new Set(players.map((p) => p.number));
  for (let n = 1; n < 100; n++) if (!taken.has(n)) return n;
  return 99;
}

function bestBy(players: Player[], position: Position | null, key: "goals" | "assists" | "cleanSheets") {
  const pool = position ? players.filter((p) => p.position === position) : players;
  if (pool.length === 0) return null;
  return pool.reduce((top, player) => (player[key] > top[key] ? player : top));
}

export interface SquadHonour {
  title: string;
  statLabel: string;
  value: number;
  player: Player;
}

export function getSquadHonours(players: Player[]): SquadHonour[] {
  // Goals and assists count for the whole squad, whatever the position.
  const scorer = bestBy(players, null, "goals");
  const provider = bestBy(players, null, "assists");
  const defender = bestBy(players, "DEF", "cleanSheets");
  const keeper = bestBy(players, "GK", "cleanSheets");

  return [
    scorer && { title: "Top goal scorer", statLabel: "goals", value: scorer.goals, player: scorer },
    provider && { title: "Top assist", statLabel: "assists", value: provider.assists, player: provider },
    defender && { title: "Top defender", statLabel: "clean sheets", value: defender.cleanSheets, player: defender },
    keeper && { title: "Top goalkeeper", statLabel: "clean sheets", value: keeper.cleanSheets, player: keeper },
  ].filter((h): h is SquadHonour => h !== null);
}

/**
 * The "bad boy of the league" — most cards, ties going to whoever has more reds.
 * Null when nobody has been booked.
 */
export function roughestPlayer(players: Player[]): Player | null {
  let top: Player | null = null;
  for (const p of players) {
    const cards = p.yellowCards + p.redCards;
    if (cards === 0) continue;
    const topCards = top ? top.yellowCards + top.redCards : 0;
    if (!top || cards > topCards || (cards === topCards && p.redCards > top.redCards)) top = p;
  }
  return top;
}

/** "2 yellows, 1 red" */
export function formatCards(yellow: number, red: number): string {
  const parts = [];
  if (yellow) parts.push(`${yellow} yellow${yellow === 1 ? "" : "s"}`);
  if (red) parts.push(`${red} red${red === 1 ? "" : "s"}`);
  return parts.join(", ") || "No cards";
}

export function topByStat(players: Player[], key: "goals" | "assists" | "cleanSheets" | "rating", count = 5) {
  const pool = key === "cleanSheets" ? players.filter(keepsCleanSheets) : players;
  return [...pool].sort((a, b) => b[key] - a[key]).slice(0, count);
}

export interface LeaderRow {
  player: Player;
  value: number;
  /** Shown instead of the number, e.g. "2Y · 1R". */
  display?: string;
}

export interface Leaderboard {
  id: string;
  title: string;
  unit: string;
  rows: LeaderRow[];
}

/**
 * The squad page leaderboards. Players on zero are left out so a board
 * never shows a list of blanks early in the season.
 */
export function squadLeaderboards(players: Player[], count = 5): Leaderboard[] {
  const board = (
    id: string,
    title: string,
    unit: string,
    value: (p: Player) => number,
    tiebreak: (p: Player) => number = () => 0,
    display?: (p: Player) => string,
  ): Leaderboard => ({
    id,
    title,
    unit,
    rows: players
      .filter((p) => value(p) > 0)
      .sort((a, b) => value(b) - value(a) || tiebreak(b) - tiebreak(a) || a.name.localeCompare(b.name))
      .slice(0, count)
      .map((p) => ({ player: p, value: value(p), display: display?.(p) })),
  });

  return [
    board("goals", "Top scorers", "goals", (p) => p.goals, (p) => -p.appearances),
    board("assists", "Top assists", "assists", (p) => p.assists, (p) => -p.appearances),
    board("clean-sheets", "Clean sheets", "clean sheets", (p) => (keepsCleanSheets(p) ? p.cleanSheets : 0), (p) => -p.appearances),
    board("saves", "Most saves", "saves", (p) => (isKeeper(p) ? p.saves : 0), (p) => -p.appearances),
    board("appearances", "Most appearances", "games", (p) => p.appearances),
    board(
      "cards",
      "Bad boys of the league",
      "cards",
      (p) => p.yellowCards + p.redCards,
      (p) => p.redCards,
      (p) => [p.yellowCards && `${p.yellowCards}Y`, p.redCards && `${p.redCards}R`].filter(Boolean).join(" · "),
    ),
    board("rating", "Highest rated", "rating", (p) => p.rating, () => 0, (p) => p.rating.toFixed(2)),
  ];
}

const CSV_COLUMNS: { header: string; value: (p: Player) => string | number }[] = [
  { header: "Number", value: (p) => p.number },
  { header: "Name", value: (p) => p.name },
  { header: "Position", value: (p) => positionCodes(p) },
  { header: "Membership", value: (p) => membershipLabels[p.membership] },
  { header: "Rating", value: (p) => p.rating },
  { header: "Appearances", value: (p) => p.appearances },
  { header: "Goals", value: (p) => p.goals },
  { header: "Assists", value: (p) => p.assists },
  { header: "Clean sheets", value: (p) => (keepsCleanSheets(p) ? p.cleanSheets : "") },
  { header: "Saves", value: (p) => (isKeeper(p) ? p.saves : "") },
];

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportPlayersCsv(players: Player[]) {
  const rows = [CSV_COLUMNS.map((c) => c.header)];
  for (const player of [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name))) {
    rows.push(CSV_COLUMNS.map((c) => csvCell(c.value(player))));
  }
  const csv = rows.map((row) => row.join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `noisers-squad-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export const seasonStats = [
  { value: "14", label: "Wins this season" },
  { value: "38", label: "Goals scored" },
  { value: "9", label: "Clean sheets" },
];
