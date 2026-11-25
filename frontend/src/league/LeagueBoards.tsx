// "Season standouts" and "Who's leading" for the league, laid out like the
// Noisers squad page's honours and leaderboards, from league numbers only.

import { ClubBadge } from "./ClubBadge";
import { clubById } from "./data";
import { fmt } from "./draw";
import { photoOf } from "./PlayersAwards";
import { useMemo, useState } from "react";
import type { LeagueData } from "./data";
import type { DrawResult } from "./draw";
import { leagueStats, type LeagueStats, type PlayerLine } from "./stats";

interface Row {
  line: PlayerLine;
  value: number;
  display?: string;
}

interface Board {
  id: string;
  title: string;
  unit: string;
  rows: Row[];
}

const cardsText = (l: PlayerLine) => [l.yellows && `${l.yellows}Y`, l.reds && `${l.reds}R`].filter(Boolean).join(" · ");

function board(
  stats: LeagueStats,
  id: string,
  title: string,
  unit: string,
  value: (l: PlayerLine) => number,
  tiebreak: (l: PlayerLine) => number = () => 0,
  display?: (l: PlayerLine) => string,
  count = 5,
): Board {
  return {
    id,
    title,
    unit,
    rows: stats.lines
      .filter((l) => value(l) > 0)
      .sort((a, b) => value(b) - value(a) || tiebreak(b) - tiebreak(a) || a.player.name.localeCompare(b.player.name))
      .slice(0, count)
      .map((l) => ({ line: l, value: value(l), display: display?.(l) })),
  };
}

/**
 * Keepers level on saves: more clean sheets first, then the higher league
 * rating. Ratings stay under 10, so /100 never outweighs a clean sheet.
 */
const keeperTiebreak = (l: PlayerLine) => l.cleanSheets + l.rating.rating / 100;

/** Defenders level on clean sheets: the higher draw (pre-league) rating goes first. */
const drawRating = (l: PlayerLine) => l.player.rating;

function leagueBoards(stats: LeagueStats): Board[] {
  const ga = (l: PlayerLine) => l.goals + l.assists;
  return [
    board(stats, "rating", "Highest rated", "league rating", (l) => (l.rating.nights.length ? l.rating.rating : 0), ga, (l) => fmt(l.rating.rating)),
    board(stats, "goals", "Top scorers", "goals", (l) => l.goals, (l) => l.assists),
    board(stats, "assists", "Top assists", "assists", (l) => l.assists, (l) => l.goals),
    board(stats, "clean-sheets", "Clean Sheets", "clean sheets", (l) => (l.player.position === "DEF" ? l.cleanSheets : 0), drawRating),
    board(stats, "saves", "Golden Glove", "saves", (l) => (l.player.position === "GK" ? l.saves : 0), keeperTiebreak),
    board(stats, "cards", "Hot heads of the league", "cards", (l) => l.yellows + l.reds, (l) => l.reds, cardsText),
  ];
}

function Who({ line }: { line: PlayerLine }) {
  return (
    <small className="nl-muted nl-lb-club">
      <ClubBadge id={line.club} size={14} /> {clubById.get(line.club)!.short} · {line.player.position}
    </small>
  );
}

/* ------------------------------------------------------------ standouts */

/** The club's colours as CSS variables, so a card can glow in them. */
const clubVars = (line: PlayerLine) => {
  const c = clubById.get(line.club)!;
  // The glow colour, not the primary: some primaries are too dark to see here.
  return { "--c1": c.colours.glow, "--glow": c.colours.glow } as React.CSSProperties;
};

const cardWords = (l: PlayerLine) =>
  [l.yellows && `${l.yellows} yellow${l.yellows === 1 ? "" : "s"}`, l.reds && `${l.reds} red${l.reds === 1 ? "" : "s"}`].filter(Boolean).join(" · ");

export function SeasonStandouts({ stats }: { stats: LeagueStats }) {
  const best = (eligible: (l: PlayerLine) => boolean, value: (l: PlayerLine) => number, tiebreak: (l: PlayerLine) => number = (l) => l.goals + l.assists) =>
    board(stats, "", "", "", (l) => (eligible(l) ? value(l) : 0), tiebreak, undefined, 1).rows[0] ?? null;

  const honours = [
    { title: "Top scorer", unit: "goals", row: best(() => true, (l) => l.goals) },
    { title: "Top assist", unit: "assists", row: best(() => true, (l) => l.assists) },
    { title: "Top defender", unit: "clean sheets", row: best((l) => l.player.position === "DEF", (l) => l.cleanSheets, drawRating) },
    { title: "Golden Glove", unit: "saves", row: best((l) => l.player.position === "GK", (l) => l.saves, keeperTiebreak) },
  ];
  // Most cards; ties go to whoever has more reds.
  const hot = board(stats, "", "", "", (l) => l.yellows + l.reds, (l) => l.reds, undefined, 1).rows[0] ?? null;

  return (
    <section className="nl-standouts" aria-labelledby="standouts-title">
      <header className="nl-x-head">
        <p className="nl-x-eyebrow">League honours</p>
        <h2 id="standouts-title" className="nl-h2">Season standouts</h2>
      </header>
      <div className="nl-honours">
        {honours.map((h) => (
          <article key={h.title} className={`nl-honour ${h.row ? "" : "is-empty"}`} style={h.row ? clubVars(h.row.line) : undefined}>
            <div className="nl-honour-media">
              {h.row ? <img src={photoOf(h.row.line.player)} alt="" loading="lazy" /> : <span className="nl-honour-blank" aria-hidden="true" />}
              <span className="nl-x-chip">{h.title}</span>
            </div>
            <div className="nl-honour-body">
              {h.row ? (
                <>
                  <p className="nl-honour-name">{h.row.line.player.name}</p>
                  <Who line={h.row.line} />
                  <p className="nl-honour-value">
                    {h.row.value}
                    <small>{h.unit}</small>
                  </p>
                </>
              ) : (
                <>
                  <p className="nl-honour-name nl-empty-cell">To be decided</p>
                  <p className="nl-muted nl-honour-wait">Nothing logged yet</p>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
      {hot && (
        <article className="nl-hothead">
          <img src={photoOf(hot.line.player)} alt="" className="nl-hothead-face" loading="lazy" />
          <div className="nl-hothead-text">
            <span className="nl-x-chip is-hot">Hot head of the league</span>
            <p className="nl-hothead-name">{hot.line.player.name}</p>
            <Who line={hot.line} />
          </div>
          <div className="nl-hothead-cards">
            <span className="nl-cards" aria-hidden="true">
              {Array.from({ length: hot.line.yellows }, (_, i) => <i key={`y${i}`} className="is-yellow" />)}
              {Array.from({ length: hot.line.reds }, (_, i) => <i key={`r${i}`} className="is-red" />)}
            </span>
            <small>{cardWords(hot.line)}</small>
          </div>
        </article>
      )}
    </section>
  );
}

/* --------------------------------------------------------- leaderboards */

export function WhosLeading({ stats }: { stats: LeagueStats }) {
  const boards = leagueBoards(stats);
  const [active, setActive] = useState(boards[0].id);
  return (
    <section className="nl-leading" aria-labelledby="leading-title">
      <header className="nl-x-head">
        <p className="nl-x-eyebrow">Leaderboards</p>
        <h2 id="leading-title" className="nl-h2">Who's leading</h2>
      </header>
      <div className="nl-lb-tabs" role="tablist" aria-label="Leaderboards">
        {boards.map((b) => (
          <button key={b.id} type="button" role="tab" aria-selected={active === b.id} aria-controls={`lb-${b.id}`} onClick={() => setActive(b.id)}>
            {b.title}
          </button>
        ))}
      </div>
      <div className="nl-lb-grid">
        {boards.map((b) => (
          <BoardCard key={b.id} board={b} hiddenOnMobile={active !== b.id} />
        ))}
      </div>
    </section>
  );
}

function BoardCard({ board, hiddenOnMobile }: { board: Board; hiddenOnMobile: boolean }) {
  const [leader, ...rest] = board.rows;
  const max = Math.max(...board.rows.map((r) => r.value), 1);
  return (
    <section
      id={`lb-${board.id}`}
      role="tabpanel"
      aria-label={board.title}
      className={`nl-lb ${hiddenOnMobile ? "is-hidden-mobile" : ""}`}
      style={leader ? clubVars(leader.line) : undefined}
    >
      <h3 className="nl-lb-title">{board.title}</h3>
      {!leader ? (
        <p className="nl-muted nl-lb-empty">Nothing logged yet.</p>
      ) : (
        <>
          <div className="nl-lb-lead">
            <span className="nl-lb-lead-face">
              <img src={photoOf(leader.line.player)} alt="" loading="lazy" />
            </span>
            <span className="nl-lb-who">
              <strong>{leader.line.player.name}</strong>
              <Who line={leader.line} />
            </span>
            <span className="nl-lb-lead-value">
              {leader.display ?? leader.value}
              <small>{board.unit}</small>
            </span>
          </div>
          {rest.length > 0 && (
            <ol className="nl-lb-rest" start={2}>
              {rest.map((r, i) => (
                <li key={r.line.player.id}>
                  <span className="nl-lb-rank">{i + 2}</span>
                  <img src={photoOf(r.line.player)} alt="" loading="lazy" className="nl-lb-face" width={30} height={30} />
                  <span className="nl-lb-who">
                    <span className="nl-lb-name">{r.line.player.name}</span>
                    <span className="nl-lb-bar">
                      <i style={{ width: `${Math.max((r.value / max) * 100, 4)}%` }} />
                    </span>
                  </span>
                  <span className="nl-lb-value">{r.display ?? r.value}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

/** Both sections as their own block, for the league home page. */
export function LeagueHonours({ draw, data }: { draw: DrawResult | null; data: LeagueData | null }) {
  const stats = useMemo(() => (draw && data ? leagueStats(draw, data) : null), [draw, data]);
  if (!stats) return null;
  return (
    <section id="standouts" className="nl-section" aria-label="Season standouts and leaderboards">
      <SeasonStandouts stats={stats} />
      <WhosLeading stats={stats} />
    </section>
  );
}
