import { useEffect, useMemo, useState, type FormEvent } from "react";
import { clockTime, type ClubId } from "../lib/league";
import { ClubBadge } from "./ClubBadge";
import { clubById, defaultNight, GAMES, nightDate, SEASON, type LeagueData } from "./data";
import type { DrawResult } from "./draw";
import {
  EXACT_POINTS,
  FANTASY_RULES,
  RESULT_POINTS,
  SLOTS,
  fantasyBoard,
  fantasyScore,
  fixtureLocked,
  nightLocked,
  predictionPoints,
  predictorBoard,
  saveFantasy,
  savePredictions,
  signIn,
  storeCredentials,
  storedCredentials,
  useGame,
  type BoardRow,
  type Credentials,
  type GameData,
  type Mine,
} from "./game";

type Tab = "predict" | "fantasy" | "boards";

const TABS: [Tab, string, string][] = [
  ["predict", "Predictor", "Call the scores"],
  ["fantasy", "Fantasy", "Pick 3 each Sunday"],
  ["boards", "Leaderboards", "Who's winning"],
];

export function PlayPage({ draw, data }: { draw: DrawResult | null; data: LeagueData | null }) {
  const live = data?.liveNight != null;
  const { game, reload } = useGame(live);
  const [tab, setTab] = useState<Tab>("predict");
  const [creds, setCreds] = useState<Credentials | null>(storedCredentials);
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");

  // Signed in on this device before: fetch their own picks (a changed PIN signs them out).
  useEffect(() => {
    if (!creds || mine) return;
    signIn(creds).then(setMine).catch(() => {
      storeCredentials(null);
      setCreds(null);
    });
  }, [creds, mine]);

  function signOut() {
    storeCredentials(null);
    setCreds(null);
    setMine(null);
  }

  const onSaved = (m: Mine) => {
    setMine(m);
    void reload();
  };

  return (
    <section id="play" className="nl-section nl-page" aria-labelledby="play-title">
      <h1 id="play-title" className="nl-h2">Play</h1>
      <p className="nl-lede">
        Two free games for the squad. Predict every score, pick a fantasy three each Sunday, and climb the leaderboards.
        No money involved, just bragging rights.
      </p>

      <div className="nl-tabs" role="tablist" aria-label="Games">
        {TABS.map(([id, label, hint]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            <span>{label}</span>
            <small>{hint}</small>
          </button>
        ))}
      </div>

      {!data || !game ? (
        <p className="nl-muted">Loading…</p>
      ) : tab === "boards" ? (
        <Boards game={game} data={data} draw={draw} />
      ) : !creds || !mine ? (
        <SignIn
          game={game}
          busy={!!creds && !mine}
          onSignedIn={(c, m) => {
            storeCredentials(c);
            setCreds(c);
            setMine(m);
            void reload();
          }}
        />
      ) : (
        <>
          <p className="nl-muted nl-play-who">
            Playing as <strong>{game.players.find((p) => p.id === creds.playerId)?.name}</strong> ·{" "}
            <button type="button" className="nl-link" onClick={signOut}>Not you?</button>
          </p>
          {error && <p className="nl-play-error" role="alert">{error}</p>}
          {tab === "predict" ? (
            <Predictor data={data} creds={creds} mine={mine} game={game} onSaved={onSaved} onError={setError} />
          ) : draw ? (
            <Fantasy data={data} draw={draw} creds={creds} mine={mine} onSaved={onSaved} onError={setError} />
          ) : (
            <p className="nl-muted">Fantasy opens once the squads are drawn.</p>
          )}
        </>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- sign in */

function SignIn({ game, busy, onSignedIn }: { game: GameData; busy: boolean; onSignedIn: (c: Credentials, m: Mine) => void }) {
  const [playerId, setPlayerId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const player = game.players.find((p) => String(p.id) === playerId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!player) return setError("Pick your name.");
    if (!/^\d{4}$/.test(pin)) return setError("Your PIN is 4 digits.");
    const c = { playerId: player.id, passcode: passcode.trim(), pin };
    setSaving(true);
    setError("");
    try {
      onSignedIn(c, await signIn(c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (busy) return <p className="nl-muted">Signing you in…</p>;

  return (
    <form className="nl-play-card nl-play-signin" onSubmit={submit}>
      <h2 className="nl-h3">Sign in to play</h2>
      <p className="nl-muted">Use the squad passcode from the committee. The first time, you choose a 4-digit PIN that keeps your picks yours.</p>
      <label>
        <span>Who are you?</span>
        <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
          <option value="">Pick your name</option>
          {game.players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Squad passcode</span>
        <input type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} required />
      </label>
      <label>
        <span>{player && !player.joined ? "Choose a 4-digit PIN" : "Your PIN"}</span>
        <input
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          required
        />
      </label>
      {player && !player.joined && <p className="nl-muted">Remember it: you'll need it on other phones. The committee can reset it if you forget.</p>}
      {error && <p className="nl-play-error" role="alert">{error}</p>}
      <button type="submit" className="nl-btn" disabled={saving}>{saving ? "Signing in…" : player && !player.joined ? "Set PIN and play" : "Sign in"}</button>
    </form>
  );
}

/* ------------------------------------------------------------- predictor */

function NightTabs({ shown, onPick, data }: { shown: number; onPick: (n: number) => void; data: LeagueData }) {
  return (
    <div className="nl-tabs" role="tablist" aria-label="Sundays">
      {SEASON.map((n) => (
        <button key={n.number} type="button" role="tab" aria-selected={shown === n.number} className={shown === n.number ? "is-active" : ""} onClick={() => onPick(n.number)}>
          <span>Sunday {n.number}</span>
          <small>{nightDate(n.number)}</small>
          {data.liveNight === n.number && <i className="nl-dot" aria-label="Live" />}
        </button>
      ))}
    </div>
  );
}

function Predictor(props: { data: LeagueData; creds: Credentials; mine: Mine; game: GameData; onSaved: (m: Mine) => void; onError: (e: string) => void }) {
  const { data, creds, mine } = props;
  const [night, setNight] = useState<number | null>(null);
  const shown = night ?? defaultNight(data);
  const games = GAMES.filter((g) => g.night === shown);
  const saved = useMemo(() => new Map(mine.predictions.map((p) => [p.matchNo, p])), [mine.predictions]);
  const [drafts, setDrafts] = useState<Record<number, { home: string; away: string }>>({});
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const value = (no: number, side: "home" | "away") => drafts[no]?.[side] ?? (saved.has(no) ? String(saved.get(no)![side]) : "");
  const setValue = (no: number, side: "home" | "away", v: string) => {
    setNote("");
    setDrafts((d) => {
      const prev = d[no] ?? { home: value(no, "home"), away: value(no, "away") };
      return { ...d, [no]: { ...prev, [side]: v.replace(/\D/g, "").slice(0, 2) } };
    });
  };

  // Only complete, open, changed predictions are sent.
  const changes = Object.entries(drafts)
    .map(([no, d]) => ({ matchNo: Number(no), home: d.home, away: d.away }))
    .filter((d) => d.home !== "" && d.away !== "" && !fixtureLocked(d.matchNo, data))
    .map((d) => ({ matchNo: d.matchNo, home: Number(d.home), away: Number(d.away) }))
    .filter((d) => saved.get(d.matchNo)?.home !== d.home || saved.get(d.matchNo)?.away !== d.away);

  async function save() {
    setSaving(true);
    props.onError("");
    try {
      props.onSaved(await savePredictions(creds, changes));
      setDrafts({});
      setNote(`Saved ${changes.length} prediction${changes.length === 1 ? "" : "s"}.`);
    } catch (err) {
      props.onError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const nightPoints = games.reduce((sum, g) => sum + (saved.has(g.no) ? (predictionPoints(saved.get(g.no)!, data) ?? 0) : 0), 0);

  return (
    <>
      <p className="nl-muted nl-notice">
        Exact score {EXACT_POINTS} points, right result {RESULT_POINTS}. Each game locks at kick-off, and everyone's picks show then.
      </p>
      <NightTabs shown={shown} onPick={setNight} data={data} />
      <ol className="nl-fixtures">
        {games.map((g) => {
          const r = data.results.find((x) => x.matchNo === g.no);
          const locked = fixtureLocked(g.no, data);
          const mineP = saved.get(g.no);
          const pts = mineP ? predictionPoints(mineP, data) : null;
          const others = props.game.predictions.filter((p) => p.matchNo === g.no);
          return (
            <li key={g.no} className={`nl-fixture nl-predict is-${r?.status ?? "scheduled"}`}>
              <span className="nl-fixture-time">{clockTime(g.start)}</span>
              <Side id={g.home} />
              {locked ? (
                <span className="nl-score">
                  {r!.homeScore}<i>–</i>{r!.awayScore}
                </span>
              ) : (
                <span className="nl-predict-inputs">
                  <input aria-label={`${clubById.get(g.home)!.name} goals`} inputMode="numeric" value={value(g.no, "home")} onChange={(e) => setValue(g.no, "home", e.target.value)} />
                  <i>–</i>
                  <input aria-label={`${clubById.get(g.away)!.name} goals`} inputMode="numeric" value={value(g.no, "away")} onChange={(e) => setValue(g.no, "away", e.target.value)} />
                </span>
              )}
              <Side id={g.away} away />
              <span className="nl-fixture-state">
                {r?.status === "live" ? <span className="nl-live-pill">Live</span> : r?.status === "final" ? "FT" : ""}
              </span>
              {locked && (
                <p className="nl-predict-note">
                  {mineP ? `You said ${mineP.home}–${mineP.away}` : "No prediction"}
                  {pts !== null && <strong className={pts > 0 ? "is-win" : ""}> · {pts} pt{pts === 1 ? "" : "s"}</strong>}
                  {others.length > 1 && <span> · {others.length} predictions in</span>}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="nl-play-actions">
        <button type="button" className="nl-btn" disabled={saving || changes.length === 0} onClick={save}>
          {saving ? "Saving…" : changes.length ? `Save ${changes.length} prediction${changes.length === 1 ? "" : "s"}` : "Save predictions"}
        </button>
        <span className="nl-muted" role="status">{note || (nightPoints ? `${nightPoints} points this Sunday so far` : "")}</span>
      </div>
    </>
  );
}

function Side({ id, away }: { id: ClubId; away?: boolean }) {
  const c = clubById.get(id)!;
  return (
    <span className={`nl-side ${away ? "is-away" : ""}`}>
      <ClubBadge id={id} size={28} />
      <span className="nl-side-name">{c.name}</span>
      <span className="nl-side-short">{c.short}</span>
    </span>
  );
}

/* --------------------------------------------------------------- fantasy */

function firstOpenNight(data: LeagueData) {
  return SEASON.find((n) => !nightLocked(n.number, data))?.number ?? SEASON.length;
}

function Fantasy(props: { data: LeagueData; draw: DrawResult; creds: Credentials; mine: Mine; onSaved: (m: Mine) => void; onError: (e: string) => void }) {
  const { data, draw, creds, mine } = props;
  const [night, setNight] = useState<number | null>(null);
  const shown = night ?? (data.liveNight ?? firstOpenNight(data));
  const locked = nightLocked(shown, data);
  const savedPick = mine.fantasy.find((f) => f.night === shown) ?? null;
  const [draft, setDraft] = useState<{ night: number; picks: (number | null)[]; captain: number | null } | null>(null);
  const current = draft?.night === shown ? draft : { night: shown, picks: savedPick?.pickIds ?? [null, null, null], captain: savedPick?.captainId ?? null };
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const everyone = useMemo(
    () =>
      (Object.keys(draw.squads) as ClubId[])
        .flatMap((club) => draw.squads[club].map((p) => ({ player: p, club })))
        .sort((a, b) => a.player.name.localeCompare(b.player.name)),
    [draw],
  );

  const setSlot = (slot: number, id: number | null) => {
    setNote("");
    const picks = [...current.picks];
    picks[slot] = id;
    setDraft({ night: shown, picks, captain: current.captain !== null && picks.includes(current.captain) ? current.captain : (picks.find((p) => p !== null) ?? null) });
  };

  const complete = current.picks.every((p) => p !== null) && current.captain !== null;
  const changed = !savedPick || savedPick.captainId !== current.captain || savedPick.pickIds.some((id, i) => id !== current.picks[i]);

  async function save() {
    if (!complete) return;
    setSaving(true);
    props.onError("");
    try {
      props.onSaved(await saveFantasy(creds, shown, current.picks as number[], current.captain!));
      setDraft(null);
      setNote("Your three are in.");
    } catch (err) {
      props.onError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const score = savedPick ? fantasyScore(savedPick, draw, data) : null;

  return (
    <>
      <p className="nl-muted nl-notice">
        Pick one keeper or defender, one midfielder and one forward from any club, and make one your captain. Picks lock when
        the Sunday's first game kicks off.
      </p>
      <NightTabs shown={shown} onPick={setNight} data={data} />

      {locked ? (
        savedPick && score ? (
          <div className="nl-play-card">
            <h2 className="nl-h3">Sunday {shown}: {score.total} points</h2>
            <ul className="nl-fantasy-lines">
              {score.lines.map((l, i) =>
                l ? (
                  <li key={l.player.id}>
                    <ClubBadge id={l.club} size={26} />
                    <span>
                      <strong>{l.player.name}{l.player.id === savedPick.captainId && " (C)"}</strong>
                      <small>{SLOTS[i].label} · {statLine(l)}</small>
                    </span>
                    <b>{l.points * (l.player.id === savedPick.captainId ? 2 : 1)}</b>
                  </li>
                ) : (
                  <li key={i}><span><small>No longer in the league</small></span><b>0</b></li>
                ),
              )}
            </ul>
          </div>
        ) : (
          <p className="nl-muted">You didn't pick a three for Sunday {shown}.</p>
        )
      ) : (
        <div className="nl-play-card">
          {SLOTS.map((slot, i) => {
            const options = everyone.filter((e) => slot.positions.includes(e.player.position));
            const chosen = current.picks[i];
            return (
              <div key={slot.label} className="nl-fantasy-slot">
                <label>
                  <span>{slot.label}</span>
                  <select value={chosen ?? ""} onChange={(e) => setSlot(i, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Pick a player</option>
                    {options.map((o) => (
                      <option key={o.player.id} value={o.player.id}>
                        {o.player.name} · {clubById.get(o.club)!.short}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="nl-captain">
                  <input type="radio" name="captain" disabled={chosen === null} checked={chosen !== null && current.captain === chosen} onChange={() => setDraft({ ...current, captain: chosen })} />
                  Captain
                </label>
              </div>
            );
          })}
          <div className="nl-play-actions">
            <button type="button" className="nl-btn" disabled={!complete || !changed || saving} onClick={save}>
              {saving ? "Saving…" : savedPick ? "Update my three" : "Lock in my three"}
            </button>
            <span className="nl-muted" role="status">{note || (savedPick && !changed ? "Saved. You can change it until kick-off." : "")}</span>
          </div>
        </div>
      )}

      <details className="nl-play-rules">
        <summary>How fantasy points work</summary>
        <dl>
          {FANTASY_RULES.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="nl-muted">A player scores from all of their club's games that Sunday.</p>
      </details>
    </>
  );
}

function statLine(l: NonNullable<ReturnType<typeof fantasyScore>["lines"][number]>) {
  const bits = [
    l.goals && `${l.goals} goal${l.goals === 1 ? "" : "s"}`,
    l.assists && `${l.assists} assist${l.assists === 1 ? "" : "s"}`,
    l.cleanSheets && `${l.cleanSheets} clean sheet${l.cleanSheets === 1 ? "" : "s"}`,
    l.saves && `${l.saves} saves`,
    l.wins && `${l.wins} win${l.wins === 1 ? "" : "s"}`,
    l.ownGoals && `${l.ownGoals} own goal${l.ownGoals === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return bits.length ? bits.join(", ") : "Nothing yet";
}

/* ---------------------------------------------------------- leaderboards */

function Boards({ game, data, draw }: { game: GameData; data: LeagueData; draw: DrawResult | null }) {
  const [night, setNight] = useState<number | 0>(0);
  const predictor = predictorBoard(game, data, night || undefined);
  const fantasy = draw ? fantasyBoard(game, draw, data, night || undefined) : [];
  return (
    <>
      <div className="nl-tabs" role="tablist" aria-label="Period">
        {[0, ...SEASON.map((n) => n.number)].map((n) => (
          <button key={n} type="button" role="tab" aria-selected={night === n} className={night === n ? "is-active" : ""} onClick={() => setNight(n)}>
            <span>{n ? `Sunday ${n}` : "Season"}</span>
            <small>{n ? nightDate(n) : "All Sundays"}</small>
          </button>
        ))}
      </div>
      <div className="nl-play-boards">
        <Board title="Predictor" rows={predictor} detail="Exact" empty="Points arrive as games finish." />
        <Board title="Fantasy" rows={fantasy} detail="Sundays" empty="Points arrive once a Sunday kicks off." />
      </div>
    </>
  );
}

function Board({ title, rows, detail, empty }: { title: string; rows: BoardRow[]; detail: string; empty: string }) {
  return (
    <div className="nl-table-wrap">
      <h2 className="nl-h3 nl-pad">{title}</h2>
      {rows.length === 0 ? (
        <p className="nl-muted nl-note">{empty}</p>
      ) : (
        <table className="nl-table">
          <thead>
            <tr>
              <th scope="col" className="is-pos">Pos</th>
              <th scope="col" className="is-club">Player</th>
              <th scope="col">{detail}</th>
              <th scope="col">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.playerId}>
                <td className="is-pos">{i + 1}</td>
                <th scope="row" className="is-club"><span>{r.name}</span></th>
                <td>{r.detail}</td>
                <td className="is-pts">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
