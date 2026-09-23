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
  lineupNumbers: number[];
}

export const teamOfTheWeek: TeamOfTheWeek = {
  week: "Week 12",
  dateRange: "15–21 Sep 2026",
  sessionsWon: 4,
  sessionsPlayed: 5,
  rivalTeam: "Team B",
  score: "2–1",
  photo: photos.stadiumCrowd,
  lineupNumbers: [1, 4, 5, 7, 8, 9, 10, 14],
};

export interface PlayerSpotlight {
  playerNumber: number;
  note: string;
  weekRating: number;
}

export const playerOfTheWeek: PlayerSpotlight = {
  playerNumber: 9,
  note: "Two goals and the assist that sealed the week's closest match day — Idehen's third player-of-the-week award this season.",
  weekRating: 9.1,
};

export interface MostImproved {
  playerNumber: number;
  note: string;
  previousRating: number;
  currentRating: number;
}

export const mostImprovedPlayer: MostImproved = {
  playerNumber: 16,
  note: "Two goal contributions in three sets after a quiet start to September — Alade's form is climbing fast.",
  previousRating: 6.2,
  currentRating: 7.0,
};

export interface WeeklyLeaders {
  topScorer: { playerNumber: number; value: number };
  topAssist: { playerNumber: number; value: number };
  cleanSheets: number[];
}

export const weeklyLeaders: WeeklyLeaders = {
  topScorer: { playerNumber: 9, value: 3 },
  topAssist: { playerNumber: 7, value: 2 },
  cleanSheets: [1, 4, 5],
};
