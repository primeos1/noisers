import { useMemo, useState } from "react";
import defaultPhoto from "../assets/player-default.svg";
import { clubs, type ClubId } from "../lib/league";
import { ClubBadge, Shirt } from "./ClubBadge";
import { clubById, nightDate, type LeagueData } from "./data";
import { fmt, type DrawResult, type Entrant } from "./draw";
import { AWARDS, champions, leagueStats, race, type PlayerLine } from "./stats";

export const photoOf = (p: Entrant) => p.photoUrl || defaultPhoto;

function Face({ player, size = 36 }: { player: Entrant; size?: number }) {
  return <img src={photoOf(player)} alt="" className="nl-face" width={size} height={size} style={{ width: size, height: size }} />;
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word.replace(/s$/, "") : word}`;

/** Both sections, sharing one pass over the results. */
export default function PlayersAwards({ draw, data }: { draw: DrawResult | null; data: LeagueData | null }) {
  const stats = useMemo(() => (draw && data ? leagueStats(draw, data) : null), [draw, data]);
  return (
    <>
      <section id="players" className="nl-section" aria-labelledby="players-title">
        <h2 id="players-title" className="nl-h2">Players</h2>
        <p className="nl-lede">
          Every player's league numbers, game by game. These are league-only: they don't touch anyone's Noisers rating or stats.
        </p>
        {stats ? <PlayerList stats={stats} /> : <p className="nl-muted">Player numbers start once the squads are drawn.</p>}
      </section>

      <section id="awards" className="nl-section" aria-labelledby="awards-title">
        <h2 id="awards-title" className="nl-h2">Awards</h2>
        <p className="nl-lede">
          {stats?.seasonOver
            ? "The season is over. These are the winners."
            : "The races so far. Every award is decided when the last game of Sunday 5 ends."}
        </p>
        {stats && data ? <AwardGrid stats={stats} data={data} /> : <p className="nl-muted">The races open after the draw.</p>}
      </section>
    </>
  );
}

/* --------------------------------------------------------------- players */

function PlayerList({ stats }: { stats: ReturnType<typeof leagueStats> }) {
  const [club, setClub] = useState<ClubId | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const rows = stats.lines
    .filter((l) => (club === "all" || l.club === club) && l.player.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goals - a.goals || b.player.rating - a.player.rating);

  return (
    <>
      <div className="nl-filters">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a player" aria-label="Find a player" />
        <div className="nl-chip-row" role="group" aria-label="Club">
          <button type="button" aria-pressed={club === "all"} onClick={() => setClub("all")}>All</button>
          {clubs.map((c) => (
            <button key={c.id} type="button" aria-pressed={club === c.id} onClick={() => setClub(c.id)} title={c.name}>
              <ClubBadge id={c.id} size={22} />
              <span>{c.short}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="nl-players">
        <div className="nl-prow nl-prow-head" aria-hidden="true">
          <span>Player</span>
          <span>P</span>
          <span>W-D-L</span>
          <span>G</span>
          <span>A</span>
          <span className="is-wide">CS</span>
          <span className="is-wide">POTN</span>
        </div>
        {rows.map((l) => (
          <div key={l.player.id} className={`nl-pentry ${open === l.player.id ? "is-open" : ""}`}>
            <button type="button" className="nl-prow" aria-expanded={open === l.player.id} onClick={() => setOpen(open === l.player.id ? null : l.player.id)}>
              <span className="nl-pwho">
                <Face player={l.player} />
                <span className="nl-pname">
                  <strong>{l.player.name}</strong>
                  <small>
                    <ClubBadge id={l.club} size={14} /> {clubById.get(l.club)!.short} · {l.player.position} · {fmt(l.player.rating)}
                  </small>
                </span>
              </span>
              <span>{l.played}</span>
              <span>{`${l.won}-${l.drawn}-${l.lost}`}</span>
              <span className="is-strong">{l.goals}</span>
              <span className="is-strong">{l.assists}</span>
              <span className="is-wide">{l.player.position === "GK" ? l.cleanSheets : "–"}</span>
              <span className="is-wide">{l.nights}</span>
            </button>
            {open === l.player.id && <PlayerDetail line={l} />}
          </div>
        ))}
        {rows.length === 0 && <p className="nl-muted nl-pad">No one matches that.</p>}
      </div>
      <p className="nl-muted nl-note">P played, CS clean sheets (keepers), POTN Player of the Night. Everyone in a squad counts in their club's games.</p>
    </>
  );
}

function PlayerDetail({ line }: { line: PlayerLine }) {
  const played = line.matches.filter((m) => m.status !== "scheduled");
  const next = line.matches.find((m) => m.status === "scheduled");
  return (
    <div className="nl-pdetail">
      <dl className="nl-pstats">
        <div><dt>Goals</dt><dd>{line.goals}</dd></div>
        <div><dt>Assists</dt><dd>{line.assists}</dd></div>
        <div><dt>Wins</dt><dd>{line.won}</dd></div>
        {line.player.position === "GK" && <div><dt>Clean sheets</dt><dd>{line.cleanSheets}</dd></div>}
        <div><dt>Hat-tricks</dt><dd>{line.hatTricks}</dd></div>
        {line.ownGoals > 0 && <div><dt>Own goals</dt><dd>{line.ownGoals}</dd></div>}
      </dl>
      {played.length === 0 ? (
        <p className="nl-muted">
          No games yet.{next && ` First up: ${clubById.get(next.opp)!.name}, Sunday ${next.night} (${nightDate(next.night)}).`}
        </p>
      ) : (
        <ol className="nl-pgames">
          {played.map((m) => {
            const res = m.status === "live" ? "Live" : m.for > m.against ? "W" : m.for < m.against ? "L" : "D";
            const bits = [m.goals && plural(m.goals, "goals"), m.assists && plural(m.assists, "assists"), m.ownGoals && plural(m.ownGoals, "own goals")].filter(Boolean);
            return (
              <li key={m.no}>
                <span className={`nl-res is-${res.toLowerCase()}`}>{res}</span>
                <span className="nl-pgame-score">
                  {m.for}–{m.against}
                </span>
                <span className="nl-pgame-opp">
                  {m.home ? "v" : "at"} <ClubBadge id={m.opp} size={18} /> {clubById.get(m.opp)!.name}
                </span>
                <span className="nl-pgame-mine">{bits.join(", ")}</span>
                <span className="nl-muted">Sun {m.night}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- awards */

function AwardGrid({ stats, data }: { stats: ReturnType<typeof leagueStats>; data: LeagueData }) {
  const top = champions(data);
  const decided = stats.seasonOver;
  const champ = clubById.get(top.club)!;
  return (
    <div className="nl-awards">
      <article className="nl-award is-champion" style={{ "--c1": champ.colours.primary } as React.CSSProperties}>
        <p className="nl-award-name">League Champions</p>
        <p className="nl-muted">{decided ? "Top of the table after 45 games." : "Top of the table right now."}</p>
        {stats.started ? (
          <div className="nl-champ">
            <Shirt id={top.club} className="nl-champ-shirt" />
            <div>
              <p className="nl-award-leader">{champ.name}</p>
              <p className="nl-muted">
                {top.pts} pts from {top.p} games
              </p>
              {decided && <span className="nl-award-tag">Champions</span>}
            </div>
          </div>
        ) : (
          <p className="nl-award-empty">Decided over five Sundays.</p>
        )}
      </article>

      {AWARDS.map((def) => {
        const list = race(stats, def);
        const [lead, ...rest] = list;
        return (
          <article key={def.id} className="nl-award">
            <p className="nl-award-name">{def.award}</p>
            <p className="nl-muted">{def.blurb}</p>
            {lead ? (
              <>
                <div className="nl-award-lead">
                  <Face player={lead.player} size={56} />
                  <div>
                    <p className="nl-award-leader">{lead.player.name}</p>
                    <p className="nl-muted">
                      <ClubBadge id={lead.club} size={14} /> {clubById.get(lead.club)!.name}
                    </p>
                  </div>
                  <p className="nl-award-value">
                    {def.value(lead)}
                    <small>{def.stat}</small>
                  </p>
                </div>
                {decided && <span className="nl-award-tag">Winner</span>}
                {rest.length > 0 && (
                  <ol className="nl-award-rest" start={2}>
                    {rest.map((l) => (
                      <li key={l.player.id}>
                        <span>{l.player.name}</span>
                        <strong>{def.value(l)}</strong>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="nl-award-empty">{def.id === "potn" ? "The first winner is named when Sunday 1 ends." : "Nobody's on the board yet."}</p>
            )}
          </article>
        );
      })}

      {stats.nightWinners.length > 0 && (
        <article className="nl-award is-wide">
          <p className="nl-award-name">Players of the Night</p>
          <ol className="nl-nights">
            {stats.nightWinners.map((w) => (
              <li key={w.night}>
                <span className="nl-muted">Sunday {w.night}</span>
                <Face player={w.line.player} size={30} />
                <strong>{w.line.player.name}</strong>
                <span className="nl-muted">
                  {plural(w.goals, "goals")}, {plural(w.assists, "assists")}
                </span>
              </li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}
