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
}

function avatar(id: number) {
  return `https://i.pravatar.cc/400?img=${id}`;
}

export const squad: Player[] = [
  { number: 1, name: "Femi Adaralegbe", position: "GK", photo: avatar(12), rating: 7.8, appearances: 14, goals: 0, assists: 1, cleanSheets: 9 },
  { number: 23, name: "Chuka Nwafor", position: "GK", photo: avatar(13), rating: 7.1, appearances: 6, goals: 0, assists: 0, cleanSheets: 3 },

  { number: 4, name: "Tunde Bakare", position: "DEF", photo: avatar(14), rating: 7.4, appearances: 16, goals: 1, assists: 2, cleanSheets: 9 },
  { number: 5, name: "Chike Obinna", position: "DEF", photo: avatar(15), rating: 7.6, appearances: 15, goals: 2, assists: 0, cleanSheets: 8 },
  { number: 22, name: "Biodun Salako", position: "DEF", photo: avatar(11), rating: 6.9, appearances: 13, goals: 0, assists: 1, cleanSheets: 7 },
  { number: 3, name: "Wale Ogundipe", position: "DEF", photo: avatar(17), rating: 7.0, appearances: 12, goals: 0, assists: 2, cleanSheets: 6 },
  { number: 6, name: "Ifeanyi Chukwu", position: "DEF", photo: avatar(18), rating: 6.8, appearances: 10, goals: 1, assists: 0, cleanSheets: 5 },

  { number: 7, name: "Segun Owolabi", position: "MID", photo: avatar(33), rating: 8.2, appearances: 17, goals: 6, assists: 8, cleanSheets: 0 },
  { number: 8, name: "Kelechi Uzo", position: "MID", photo: avatar(56), rating: 7.7, appearances: 16, goals: 4, assists: 5, cleanSheets: 0 },
  { number: 14, name: "Ola Jegede", position: "MID", photo: avatar(57), rating: 7.5, appearances: 15, goals: 3, assists: 7, cleanSheets: 0 },
  { number: 16, name: "Tobi Alade", position: "MID", photo: avatar(58), rating: 7.0, appearances: 11, goals: 2, assists: 4, cleanSheets: 0 },
  { number: 18, name: "Emeka Nnamdi", position: "MID", photo: avatar(59), rating: 6.7, appearances: 9, goals: 1, assists: 3, cleanSheets: 0 },

  { number: 9, name: "Marcus Idehen", position: "FWD", photo: avatar(51), rating: 8.6, appearances: 17, goals: 11, assists: 3, cleanSheets: 0 },
  { number: 10, name: "Dayo Fashola", position: "FWD", photo: avatar(52), rating: 8.1, appearances: 16, goals: 9, assists: 6, cleanSheets: 0 },
  { number: 11, name: "Rasheed Animashaun", position: "FWD", photo: avatar(53), rating: 7.6, appearances: 14, goals: 7, assists: 4, cleanSheets: 0 },
  { number: 17, name: "Kola Adisa", position: "FWD", photo: avatar(54), rating: 6.8, appearances: 10, goals: 3, assists: 1, cleanSheets: 0 },
];

export function findPlayer(number: number): Player {
  const player = squad.find((p) => p.number === number);
  if (!player) throw new Error(`Unknown player number ${number}`);
  return player;
}

function best(position: Position, key: "goals" | "assists" | "cleanSheets") {
  return squad
    .filter((p) => p.position === position)
    .reduce((top, player) => (player[key] > top[key] ? player : top));
}

export const bestStriker = best("FWD", "goals");
export const bestMidfielder = best("MID", "assists");
export const bestDefender = best("DEF", "cleanSheets");
export const bestGoalkeeper = best("GK", "cleanSheets");

export const squadHonours = [
  { title: "Top striker", statLabel: "goals", value: bestStriker.goals, player: bestStriker },
  { title: "Top midfielder", statLabel: "assists", value: bestMidfielder.assists, player: bestMidfielder },
  { title: "Top defender", statLabel: "clean sheets", value: bestDefender.cleanSheets, player: bestDefender },
  { title: "Top goalkeeper", statLabel: "clean sheets", value: bestGoalkeeper.cleanSheets, player: bestGoalkeeper },
];

export interface Fixture {
  opponent: string;
  competition: string;
  date: string;
  time: string;
  venue: "Home" | "Away";
  location: string;
}

export const nextFixture: Fixture = {
  opponent: "Kestrel Athletic",
  competition: "Vale Sunday 5-a-side League",
  date: "Sat 27 Sep",
  time: "15:00",
  venue: "Home",
  location: "Zenith Astro, Pitch 2",
};

export interface Result {
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
  venue: "Home" | "Away";
  date: string;
  scorers: string[];
}

export const latestResult: Result = {
  opponent: "Dockside Rovers",
  scoreFor: 4,
  scoreAgainst: 2,
  venue: "Away",
  date: "Sat 20 Sep",
  scorers: ["Idehen 2'", "Fashola 34'", "Owolabi 61'"],
};

export const clubStats = [
  { value: "16", label: "Squad" },
  { value: "14", label: "Wins this season" },
  { value: "38", label: "Goals scored" },
  { value: "9", label: "Clean sheets" },
];
