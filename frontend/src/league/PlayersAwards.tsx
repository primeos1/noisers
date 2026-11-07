import { useMemo, useState } from "react";
import defaultPhoto from "../assets/player-default.svg";
import { clubs, type ClubId } from "../lib/league";
import { ClubBadge, Shirt } from "./ClubBadge";
import { clubById, nightDate, type LeagueData } from "./data";
import { fmt, type DrawResult, type Entrant } from "./draw";
import { AWARDS, champions, leagueStats, race, type LeagueStats, type PlayerLine } from "./stats";

export const photoOf = (p: Entrant) => p.photoUrl || defaultPhoto;

function Face({ player, size = 36 }: { player: Entrant; size?: number }) {
  return <img src={photoOf(player)} alt="" className="nl-face" width={size} height={size} style={{ width: size, height: size }} />;
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word.replace(/s$/, "") : word}`;

function useStats(draw: DrawResult | null, data: LeagueData | null) {
  return useMemo(() => (draw && data ? leagueStats(draw, data) : null), [draw, data]);
}

/* --------------------------------------------------------------- players */

export function PlayersPage({ draw, data }: { draw: DrawResult | null; data: LeagueData | null }) {
  const stats = useStats(draw, data);
  return (
    <section id="players" className="nl-section nl-page" aria-labelledby="players-title">
      <h1 id="players-title" className="nl-h2">Players</h1>
      <p className="nl-lede">
        Every player's league numbers, game by game. These are league-only: they don't touch anyone's Noisers rating or stats.
      </p>
      {stats ? (
        <PlayerList stats={stats} />
      ) : (
        <EmptyPlayers entrants={data?.entrants ?? []} loading={!data} />
      )}
    </section>
  );
}

/** Before the draw: everyone who's in, with their slots still empty. */
function EmptyPlayers({ entrants, loading }: { entrants: Entrant[]; loading: boolean }) {
  const rows = [...entrants].sort((a, b) => a.name.localeCompare(b.name));
  const ghosts = loading || rows.length === 0 ? 8 : 0;
  return (
    <>
      <p className="nl-muted nl-notice">Clubs are filled at the draw. Numbers appear here from the first game on 15 November.</p>
      <div className="nl-players">
        <PlayerHead />
        {rows.map((p) => (
          <div key={p.id} className="nl-prow is-static">
            <span className="nl-pwho">
              <Face player={p} />
              <span className="nl-pname">
                <strong>{p.name}</strong>
                <small>Club to be drawn · {p.position} · {fmt(p.rating)}</small>
              </span>
            </span>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={`nl-empty-cell ${i >= 4 ? "is-wide" : ""}`}>–</span>
            ))}
          </div>
        ))}
        {Array.from({ length: ghosts }, (_, i) => (
          <div key={`g${i}`} className="nl-prow is-static" aria-hidden="true">
            <span className="nl-pwho">
              <span className="nl-face nl-ghost" />
              <span className="nl-ghost-line" />
            </span>
            {Array.from({ length: 6 }, (_, j) => (
              <span key={j} className={`nl-empty-cell ${j >= 4 ? "is-wide" : ""}`}>–</span>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function PlayerHead() {
  return (
    <div className="nl-prow nl-prow-head" aria-hidden="true">
      <span>Player</span>
      <span>P</span>
      <span>W-D-L</span>
      <span>G</span>
      <span>A</span>
      <span className="is-wide">CS</span>
      <span className="is-wide">POTN</span>
    </div>
  );
}

function PlayerList({ stats }: { stats: LeagueStats }) {
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
        <PlayerHead />
        {rows.map((l) => {
          const none = !stats.started;
          return (
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
                <span className={none ? "nl-empty-cell" : ""}>{none ? "–" : l.played}</span>
                <span className={none ? "nl-empty-cell" : ""}>{none ? "–" : `${l.won}-${l.drawn}-${l.lost}`}</span>
                <span className={none ? "nl-empty-cell" : "is-strong"}>{none ? "–" : l.goals}</span>
                <span className={none ? "nl-empty-cell" : "is-strong"}>{none ? "–" : l.assists}</span>
                <span className={`is-wide ${none ? "nl-empty-cell" : ""}`}>{none || l.player.position !== "GK" ? "–" : l.cleanSheets}</span>
                <span className={`is-wide ${none ? "nl-empty-cell" : ""}`}>{none ? "–" : l.nights}</span>
              </button>
              {open === l.player.id && <PlayerDetail line={l} />}
            </div>
          );
        })}
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

export function AwardsPage({ draw, data }: { draw: DrawResult | null; data: LeagueData | null }) {
  const stats = useStats(draw, data);
  const top = data && stats?.started ? champions(data) : null;
  const decided = !!stats?.seasonOver;
  const champ = top ? clubById.get(top.club)! : null;

  return (
    <section id="awards" className="nl-section nl-page" aria-labelledby="awards-title">
      <h1 id="awards-title" className="nl-h2">Awards</h1>
      <p className="nl-lede">
        {decided ? "The season is over. These are the winners." : "Every award is decided when the last game of Sunday 5 ends. Until then, these are the races."}
      </p>
      <div className="nl-awards">
        <article className="nl-award is-champion" style={champ ? ({ "--c1": champ.colours.primary } as React.CSSProperties) : undefined}>
          <p className="nl-award-name">League Champions</p>
          <p className="nl-muted">{decided ? "Top of the table after 45 games." : "The club top of the table."}</p>
          {top && champ ? (
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
            <div className="nl-champ">
              <span className="nl-champ-shirt nl-ghost-shirt" aria-hidden="true" />
              <div>
                <p className="nl-award-leader nl-empty-cell">To be decided</p>
                <p className="nl-muted">0 pts</p>
              </div>
            </div>
          )}
        </article>

        {AWARDS.map((def) => {
          const list = stats ? race(stats, def) : [];
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
                  <RunnersUp rest={rest.map((l) => ({ id: l.player.id, name: l.player.name, value: def.value(l) }))} />
                </>
              ) : (
                <>
                  <div className="nl-award-lead" aria-label="No leader yet">
                    <span className="nl-face nl-ghost" style={{ width: 56, height: 56 }} />
                    <div>
                      <p className="nl-award-leader nl-empty-cell">Open</p>
                      <p className="nl-muted">No one yet</p>
                    </div>
                    <p className="nl-award-value nl-empty-cell">
                      0<small>{def.stat}</small>
                    </p>
                  </div>
                  <RunnersUp rest={[]} />
                </>
              )}
            </article>
          );
        })}

        <article className="nl-award is-wide">
          <p className="nl-award-name">Players of the Night</p>
          <p className="nl-muted">The best player of each Sunday, named when its last game ends.</p>
          <ol className="nl-nights">
            {[1, 2, 3, 4, 5].map((night) => {
              const w = stats?.nightWinners.find((x) => x.night === night);
              return (
                <li key={night}>
                  <span className="nl-muted">
                    Sunday {night}, {nightDate(night)}
                  </span>
                  {w ? (
                    <>
                      <Face player={w.line.player} size={30} />
                      <strong>{w.line.player.name}</strong>
                      <span className="nl-muted">
                        {plural(w.goals, "goals")}, {plural(w.assists, "assists")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="nl-face nl-ghost" style={{ width: 30, height: 30 }} />
                      <span className="nl-empty-cell">To be decided</span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </article>
      </div>
    </section>
  );
}

/** Places 2-4, with empty slots until someone fills them. */
function RunnersUp({ rest }: { rest: { id: number; name: string; value: number }[] }) {
  return (
    <ol className="nl-award-rest" start={2}>
      {[0, 1, 2].map((i) => {
        const r = rest[i];
        return r ? (
          <li key={r.id}>
            <span>{r.name}</span>
            <strong>{r.value}</strong>
          </li>
        ) : (
          <li key={`e${i}`} className="nl-empty-cell">
            <span>–</span>
          </li>
        );
      })}
    </ol>
  );
}
