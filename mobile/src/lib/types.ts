// Shapes returned by the Laravel API resources (backend/app/Http/Resources).
// Match day types mirror frontend/src/lib/matchDay.ts.

export type Position = "GK" | "DEF" | "MID" | "FWD";

/** A full club member, or a guest member who plays with the squad. */
export type Membership = "member" | "guest";

export const membershipLabels: Record<Membership, string> = {
  member: "Member",
  guest: "Guest member",
};

export interface Player {
  id: number;
  number: number;
  name: string;
  position: Position;
  /** Optional second position; the main one drives team balancing and ratings. */
  secondaryPosition: Position | null;
  membership: Membership;
  bio: string | null;
  photoUrl: string | null;
  active: boolean;
  rating: number;
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
}

export type CardType = "yellow" | "red";

export interface Card {
  id: number;
  playerId: number;
  type: CardType;
  reason: string | null;
  fineAmount: number;
  paid: boolean;
  occurredOn: string | null;
  createdAt: string | null;
}

export type TeamMode = "random" | "rating" | "position";

/** Mirrors ClubSettingResource — see frontend/src/lib/SettingsContext.tsx. */
export interface ClubSettings {
  yellowCardFine: number;
  redCardFine: number;
  finesFromMatchDay: boolean;
  matchTeamSize: number;
  matchWinGoals: number;
  matchGameMinutes: number;
  matchDefaultTeamMode: TeamMode;
  matchDefaultVenue: string;
  ratingsEnabled: boolean;
  ratingNewPlayer: number;
  ratingWin: number;
  ratingLoss: number;
  ratingGoal: number;
  ratingAssist: number;
  ratingOwnGoal: number;
  ratingCleanSheetGk: number;
  ratingCleanSheetDef: number;
  ratingCleanSheetMid: number;
  ratingCleanSheetFwd: number;
  ratingYellowCard: number;
  ratingRedCard: number;
  ratingMaxSwing: number;
  valeAutoAwards: boolean;
}

// A squad player is referenced by player id (shirt numbers can repeat); a
// guest by an id like "guest-1".
export type ParticipantId = number | string;

export interface Guest {
  id: string;
  name: string;
}

export interface MatchDayTeam {
  name: string;
  players: ParticipantId[];
}

export interface MatchDayGoal {
  id: string;
  teamIndex: 0 | 1;
  playerId: ParticipantId;
  assistPlayerId?: ParticipantId | null;
  ownGoal: boolean;
  minute: number;
}

export interface MatchDayCard {
  id: string;
  teamIndex: 0 | 1;
  playerId: ParticipantId;
  type: CardType;
  reason: string;
  minute: number;
}

export interface MatchDayGame {
  id: string;
  teams: [MatchDayTeam, MatchDayTeam];
  goals: MatchDayGoal[];
  cards: MatchDayCard[];
  status: "live" | "finished";
  /** Epoch ms when the clock was last started; null while paused. */
  clockStartedAt?: number | null;
  /** Seconds of play before the current run. */
  clockElapsed?: number;
}

export interface MatchDayEvent {
  id: string;
  title: string;
  venue: string | null;
  date: string;
  createdAt: string | null;
  presentPlayers: number[];
  guests: Guest[];
  groups: MatchDayTeam[];
  games: MatchDayGame[];
  status: "live" | "ended";
}

// Public-site content the committee edits (HighlightResource, HomeContentResource).

export type MediaType = "photo" | "video";
export type HighlightCategory = "Goals" | "Saves" | "Skills" | "Matchday" | "Behind the scenes";

export interface Highlight {
  id: number;
  type: MediaType;
  src: string;
  alt: string | null;
  caption: string | null;
  category: HighlightCategory;
  date: string | null;
  tall: boolean;
  sortOrder: number;
}

export type LiveStatId = "squad" | "match_days" | "games" | "goals";

export interface HomeStat {
  id: number;
  value: string;
  label: string;
  sortOrder: number;
}

export interface GalleryImage {
  id: number;
  imageUrl: string;
  alt: string | null;
  caption: string | null;
  sortOrder: number;
}

export interface HomeContent {
  hero: { eyebrow: string; headline: string; subtext: string; imageUrl: string };
  story: { eyebrow: string; headline: string; paragraph1: string; paragraph2: string; imageUrl: string };
  atmosphere: { caption: string; imageUrl: string };
  matchday: { eyebrow: string; headline: string; body: string };
  footer: { tagline: string; copyright: string };
  statsSection: { enabled: boolean; eyebrow: string; headline: string; imageUrl: string; live: LiveStatId[] };
  stats: HomeStat[];
  gallery: GalleryImage[];
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "committee";
}
