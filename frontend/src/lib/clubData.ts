// Sample content for the frontend build-out. Every record here is shaped
// exactly like the data the Laravel API will return later, so swapping
// this file for a fetch() call is the only change needed once the
// backend is live.

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Player {
  number: number;
  name: string;
  position: Position;
  photo: string;
  rating: number;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
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

export const seedSquad: Player[] = [
  { number: 1, name: "Femi Adaralegbe", position: "GK", photo: avatar(12), rating: 7.8, appearances: 14, goals: 0, assists: 1, cleanSheets: 9, yellowCards: 0, redCards: 0 },
  { number: 23, name: "Chuka Nwafor", position: "GK", photo: avatar(13), rating: 7.1, appearances: 6, goals: 0, assists: 0, cleanSheets: 3, yellowCards: 0, redCards: 0 },

  { number: 4, name: "Tunde Bakare", position: "DEF", photo: avatar(14), rating: 7.4, appearances: 16, goals: 1, assists: 2, cleanSheets: 9, yellowCards: 0, redCards: 0 },
  { number: 5, name: "Chike Obinna", position: "DEF", photo: avatar(15), rating: 7.6, appearances: 15, goals: 2, assists: 0, cleanSheets: 8, yellowCards: 0, redCards: 0 },
  { number: 22, name: "Biodun Salako", position: "DEF", photo: avatar(11), rating: 6.9, appearances: 13, goals: 0, assists: 1, cleanSheets: 7, yellowCards: 0, redCards: 0 },
  { number: 3, name: "Wale Ogundipe", position: "DEF", photo: avatar(17), rating: 7.0, appearances: 12, goals: 0, assists: 2, cleanSheets: 6, yellowCards: 0, redCards: 0 },
  { number: 6, name: "Ifeanyi Chukwu", position: "DEF", photo: avatar(18), rating: 6.8, appearances: 10, goals: 1, assists: 0, cleanSheets: 5, yellowCards: 0, redCards: 0 },

  { number: 7, name: "Segun Owolabi", position: "MID", photo: avatar(33), rating: 8.2, appearances: 17, goals: 6, assists: 8, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 8, name: "Kelechi Uzo", position: "MID", photo: avatar(56), rating: 7.7, appearances: 16, goals: 4, assists: 5, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 14, name: "Ola Jegede", position: "MID", photo: avatar(57), rating: 7.5, appearances: 15, goals: 3, assists: 7, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 16, name: "Tobi Alade", position: "MID", photo: avatar(58), rating: 7.0, appearances: 11, goals: 2, assists: 4, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 18, name: "Emeka Nnamdi", position: "MID", photo: avatar(59), rating: 6.7, appearances: 9, goals: 1, assists: 3, cleanSheets: 0, yellowCards: 0, redCards: 0 },

  { number: 9, name: "Marcus Idehen", position: "FWD", photo: avatar(51), rating: 8.6, appearances: 17, goals: 11, assists: 3, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 10, name: "Dayo Fashola", position: "FWD", photo: avatar(52), rating: 8.1, appearances: 16, goals: 9, assists: 6, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 11, name: "Rasheed Animashaun", position: "FWD", photo: avatar(53), rating: 7.6, appearances: 14, goals: 7, assists: 4, cleanSheets: 0, yellowCards: 0, redCards: 0 },
  { number: 17, name: "Kola Adisa", position: "FWD", photo: avatar(54), rating: 6.8, appearances: 10, goals: 3, assists: 1, cleanSheets: 0, yellowCards: 0, redCards: 0 },
];

export function findPlayer(players: Player[], number: number): Player {
  const player = players.find((p) => p.number === number);
  if (!player) throw new Error(`Unknown player number ${number}`);
  return player;
}

export function nextJerseyNumber(players: Player[]): number {
  const taken = new Set(players.map((p) => p.number));
  for (let n = 1; n < 100; n++) if (!taken.has(n)) return n;
  return 99;
}

function bestBy(players: Player[], position: Position, key: "goals" | "assists" | "cleanSheets") {
  const inPosition = players.filter((p) => p.position === position);
  if (inPosition.length === 0) return null;
  return inPosition.reduce((top, player) => (player[key] > top[key] ? player : top));
}

export interface SquadHonour {
  title: string;
  statLabel: string;
  value: number;
  player: Player;
}

export function getSquadHonours(players: Player[]): SquadHonour[] {
  const striker = bestBy(players, "FWD", "goals");
  const midfielder = bestBy(players, "MID", "assists");
  const defender = bestBy(players, "DEF", "cleanSheets");
  const keeper = bestBy(players, "GK", "cleanSheets");

  return [
    striker && { title: "Top striker", statLabel: "goals", value: striker.goals, player: striker },
    midfielder && { title: "Top midfielder", statLabel: "assists", value: midfielder.assists, player: midfielder },
    defender && { title: "Top defender", statLabel: "clean sheets", value: defender.cleanSheets, player: defender },
    keeper && { title: "Top goalkeeper", statLabel: "clean sheets", value: keeper.cleanSheets, player: keeper },
  ].filter((h): h is SquadHonour => h !== null);
}

/**
 * The "roughest player" — most cards, ties going to whoever has more reds.
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
  return [...players].sort((a, b) => b[key] - a[key]).slice(0, count);
}

const CSV_COLUMNS: { header: string; value: (p: Player) => string | number }[] = [
  { header: "Number", value: (p) => p.number },
  { header: "Name", value: (p) => p.name },
  { header: "Position", value: (p) => p.position },
  { header: "Rating", value: (p) => p.rating },
  { header: "Appearances", value: (p) => p.appearances },
  { header: "Goals", value: (p) => p.goals },
  { header: "Assists", value: (p) => p.assists },
  { header: "Clean sheets", value: (p) => p.cleanSheets },
];

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportPlayersCsv(players: Player[]) {
  const rows = [CSV_COLUMNS.map((c) => c.header)];
  for (const player of [...players].sort((a, b) => a.number - b.number)) {
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
