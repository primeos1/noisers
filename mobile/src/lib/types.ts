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
  /** Keepers (GK as main or second position), or whoever went in goal for a side without one. */
  saves?: number;
  /** Penalties saved — already included in saves. */
  penaltySaves?: number;
  /** Cards from match day records this season. */
  yellowCards?: number;
  redCards?: number;
  /** Times named player of the week / picked in the team of the week. */
  playerOfTheWeekWins?: number;
  teamOfTheWeekSelections?: number;
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

/** What a player's rating responds to; each set per position. */
export type RatingWeightKey =
  | "win"
  | "loss"
  | "goal"
  | "assist"
  | "cleanSheet"
  | "goalConceded"
  | "save"
  | "penaltySave"
  | "ownGoal"
  | "yellowCard"
  | "redCard";

export type PositionWeights = Record<RatingWeightKey, number>;

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
  ratingPositions: Record<Position, PositionWeights>;
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

/** One per save — only keepers make them. */
export interface MatchDaySave {
  id: string;
  teamIndex: 0 | 1;
  playerId: ParticipantId;
  minute: number;
  /** A saved penalty — still a save, with its own rating weight. */
  penalty?: boolean;
}

export interface MatchDayGame {
  id: string;
  teams: [MatchDayTeam, MatchDayTeam];
  goals: MatchDayGoal[];
  cards: MatchDayCard[];
  /** Missing on games logged before saves were recorded. */
  saves?: MatchDaySave[];
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
  /** Its week number, set by the server: Matchday 1 and 2 are week 1, 3 and 4 week 2, and so on. */
  week?: number;
  presentPlayers: number[];
  guests: Guest[];
  groups: MatchDayTeam[];
  games: MatchDayGame[];
  status: "live" | "ended";
  /** How the teams were last drawn; missing until they are. */
  teamMode?: TeamMode | null;
  /** The server's save counter — see the save queue in lib/club.tsx. */
  version?: number;
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

// Who's out — injured, travelling, suspended or otherwise unavailable
// (PlayerAbsenceResource). Status is worked out by the API against today.

export type AbsenceType = "injury" | "travel" | "suspension" | "other";
export type AbsenceStatus = "upcoming" | "active" | "ended";

export interface Absence {
  id: number;
  playerId: number;
  type: AbsenceType;
  reason: string | null;
  /** yyyy-mm-dd */
  startsOn: string;
  /** yyyy-mm-dd, or null while there's no return date. */
  endsOn: string | null;
  status: AbsenceStatus;
}

// The people who run the club (ExecutiveResource).

export type ExecutiveGroup = "executive" | "staff" | "disciplinary";

export interface Executive {
  id: number;
  name: string;
  title: string;
  group: ExecutiveGroup;
  photo: string | null;
  sortOrder: number;
}

// Noisers — the club blog, written by the API from match days, cards and
// absences (App\Support\NoisersFeed). Mirrors frontend/src/lib/noisers.ts.

export type StoryKind =
  | "match_report"
  | "team_of_week"
  | "discipline"
  | "injury"
  | "travel"
  | "suspension"
  | "unavailable"
  | "comeback";

export interface StoryCard {
  playerId: number | null;
  name: string;
  type: CardType;
  reason: string | null;
  minute: number | null;
}

export interface Story {
  id: string;
  kind: StoryKind;
  tag: string;
  publishedAt: string;
  headline: string;
  standfirst: string;
  body: string[];
  /** Featured players, the lead first. */
  playerIds: number[];
  matchDay: { id: string; title: string; venue: string | null; date: string } | null;
  scoreline: { home: string; away: string; homeScore: number; awayScore: number }[] | null;
  stats: { label: string; value: number }[] | null;
  /** The team of the match day: its six, keeper first, with the position each was picked for. */
  lineup: { team: string; playerIds: number[]; positions: string[] } | null;
  cards: StoryCard[] | null;
  absence: { type: AbsenceType; reason: string | null; startsOn: string; endsOn: string | null; status: AbsenceStatus } | null;
}

/** /match-day-events/{id}/team-of-week */
export interface TeamOfWeekPick {
  playerId: number;
  position: Position;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  appearances: number;
}

/** One match day's own awards, from that day's ratings alone. */
export interface MatchDayAwards {
  id: string;
  title: string;
  date: string;
  /** The day's best keeper, two defenders, two midfielders and forward, in that order. */
  lineup: TeamOfWeekPick[];
  playerOfMatchDay: TeamOfWeekPick | null;
}

export interface TeamOfWeek {
  /** "Week of 28 Sep". */
  title: string;
  /** The week's match day dates, e.g. "Wed 30 Sept & Sun 4 Oct". */
  dateRange: string;
  /** Every match day of the week that was compared (its two match days). */
  weekMatchDays?: { id: string; title: string; date: string }[];
  /** The week's best keeper, two defenders, two midfielders and forward, in that order. */
  lineup: TeamOfWeekPick[];
  lineupPlayerIds: number[];
  /** The week's highest-rated player, with both match days' points added up. */
  playerOfWeek?: TeamOfWeekPick | null;
  /** The team and player of each of the week's match days, oldest first. */
  matchDays?: MatchDayAwards[];
  /** The side at the bottom of the table — null when only one side played. */
  flopTeam?: { name: string; won: number; played: number; gd: number; lineupPlayerIds: number[] } | null;
}
