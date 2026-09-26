// "The Vale" weekly awards — sample content shaped like the future API
// response. Updated by the committee every week once a set/matchday
// finishes; swapping in a fetch() call later is a drop-in change.

import { photos } from "./photos";

export interface TeamOfTheWeek {
  week: string;
  dateRange: string;
  sessionsWon: number;
  sessionsPlayed: number;
  rivalTeam: string;
  score: string;
  photo: string;
  lineupPlayerIds: number[];
}

export const teamOfTheWeek: TeamOfTheWeek = {
  week: "Week 12",
  dateRange: "15–21 Sep 2026",
  sessionsWon: 4,
  sessionsPlayed: 5,
  rivalTeam: "Team B",
  score: "2–1",
  photo: photos.stadiumCrowd,
  lineupPlayerIds: [1, 3, 4, 8, 9, 13, 14, 10],
};

export interface PlayerSpotlight {
  playerId: number;
  note: string;
  weekRating: number;
}

export const playerOfTheWeek: PlayerSpotlight = {
  playerId: 13,
  note: "Two goals and the assist that sealed the week's closest match day — Idehen's third player-of-the-week award this season.",
  weekRating: 9.1,
};

export interface MostImproved {
  playerId: number;
  note: string;
  previousRating: number;
  currentRating: number;
}

export const mostImprovedPlayer: MostImproved = {
  playerId: 11,
  note: "Two goal contributions in three sets after a quiet start to September — Alade's form is climbing fast.",
  previousRating: 6.2,
  currentRating: 7.0,
};

export interface WeeklyLeaders {
  topScorer: { playerId: number; value: number };
  topAssist: { playerId: number; value: number };
  cleanSheets: number[];
}

export const weeklyLeaders: WeeklyLeaders = {
  topScorer: { playerId: 13, value: 3 },
  topAssist: { playerId: 8, value: 2 },
  cleanSheets: [1, 3, 4],
};
