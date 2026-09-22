// Sample content for the frontend build-out. Every record here is shaped
// exactly like the data the Laravel API will return later, so swapping
// this file for a fetch() call is the only change needed once the
// backend is live.

export type Position = "GK" | "DEF" | "MID" | "FWD";

export interface Player {
  number: number;
  name: string;
  position: Position;
  goals: number;
  assists: number;
}

export const squad: Player[] = [
  { number: 1, name: "Femi Adaralegbe", position: "GK", goals: 0, assists: 1 },
  { number: 4, name: "Tunde Bakare", position: "DEF", goals: 1, assists: 2 },
  { number: 5, name: "Chike Obinna", position: "DEF", goals: 2, assists: 0 },
  { number: 7, name: "Segun Owolabi", position: "MID", goals: 6, assists: 8 },
  { number: 8, name: "Kelechi Uzo", position: "MID", goals: 4, assists: 5 },
  { number: 9, name: "Marcus Idehen", position: "FWD", goals: 11, assists: 3 },
  { number: 10, name: "Dayo Fashola", position: "FWD", goals: 9, assists: 6 },
  { number: 11, name: "Rasheed Animashaun", position: "FWD", goals: 7, assists: 4 },
  { number: 14, name: "Ola Jegede", position: "MID", goals: 3, assists: 7 },
  { number: 22, name: "Biodun Salako", position: "DEF", goals: 0, assists: 1 },
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
  { value: "24", label: "Squad" },
  { value: "14", label: "Wins this season" },
  { value: "38", label: "Goals scored" },
  { value: "9", label: "Clean sheets" },
];
