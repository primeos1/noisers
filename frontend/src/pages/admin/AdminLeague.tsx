import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useSquad } from "../../lib/SquadContext";
import { clockTime, type ClubId } from "../../lib/league";
import { clubById, fetchLeague, GAMES, nightDate, SEASON, useResultsByNo, type LeagueData } from "../../league/data";
import { buildPots, fmt, runDraw, type DrawResult, type Entrant } from "../../league/draw";
import { ClubBadge } from "../../league/ClubBadge";
import { CaptainBadge } from "../../league/CaptainBadge";
import { leagueUrl } from "../../league/url";

type Tab = "players" | "draw" | "matchday";

const tabs: { id: Tab; label: string }[] = [
  { id: "players", label: "Who's in" },
  { id: "draw", label: "The draw" },
  { id: "matchday", label: "Match day" },
];

const btn = "rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary = `${btn} bg-paper text-ink hover:bg-paper/85`;
const btnGhost = `${btn} border border-ink-line text-paper hover:border-paper`;
const btnDanger = `${btn} border border-loss/50 text-loss hover:bg-loss/10`;

/**
 * The league's committee tools. Everything here writes to the league's own
 * tables; club match days, ratings and the Vale are untouched.
 */
export default function AdminLeague() {
  const [tab, setTab] = useState<Tab>("players");
  const [data, setData] = useState<LeagueData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchLeague()
      .then((r) => setData(r.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  /** Runs a write; every league write answers with the full league state. */
  async function act(path: string, method: string, body?: unknown) {
    setError("");
    try {
      const r = await apiFetch<{ data: LeagueData }>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      setData(r.data);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
      return false;
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-paper-dim">league.noisersfc.com</p>
          <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">The Noisers League</h1>
        </div>
        <a href={leagueUrl()} target="_blank" rel="noreferrer" className={btnGhost}>
          Open the league site
        </a>
      </div>
      <p className="mt-4 max-w-2xl text-sm text-paper-dim">
        Mark who's playing, seal the live draw and run the Sunday match days. None of this changes club match days, ratings or
        the Vale.
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`${btn} shrink-0 ${tab === t.id ? "bg-justice text-ink" : "border border-ink-line text-paper-dim hover:text-paper"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">{error}</p>}
      {!data ? (
        !error && <p className="mt-8 text-sm text-mist">Loading the league…</p>
      ) : tab === "players" ? (
        <PlayersTab data={data} act={act} />
      ) : tab === "draw" ? (
        <DrawTab data={data} act={act} />
      ) : (
        <MatchdayTab data={data} act={act} />
      )}
    </div>
  );
}

type Act = (path: string, method: string, body?: unknown) => Promise<boolean>;

/* ------------------------------------------------------------ who's in */

function PlayersTab({ data, act }: { data: LeagueData; act: Act }) {
  const { players } = useSquad();
  const [picked, setPicked] = useState<Set<number>>(() => new Set(data.entrantIds));
  const [gk, setGk] = useState<Set<number>>(() => new Set(data.keeperIds));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const locked = !!data.draw;

  const roster = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);
  const shown = roster.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const sameSet = (a: Set<number>, b: number[]) => a.size === b.length && b.every((id) => a.has(id));
  const dirty = !sameSet(picked, data.entrantIds) || !sameSet(gk, data.keeperIds);
  const position = (p: { id: number; position: Entrant["position"] }) => (gk.has(p.id) ? "GK" : p.position);

  const chosen = roster.filter((p) => picked.has(p.id));
  const entrants: Entrant[] = chosen.map((p) => ({ id: p.id, name: p.name, position: position(p), rating: p.rating }));
  const pots = buildPots(entrants);
  const keepers = chosen.filter((p) => position(p) === "GK").length;
  const lo = Math.floor(chosen.length / 6);
  const hi = Math.ceil(chosen.length / 6);

  function toggle(id: number) {
    if (locked) return;
    setSaved(false);
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const ok = await act("/league/entrants", "PUT", { player_ids: [...picked], keeper_ids: [...gk] });
    setSaving(false);
    setSaved(ok);
  }

  return (
    <section className="mt-8">
      {locked && (
        <p className="mb-5 border border-justice/40 bg-justice/10 px-4 py-3 text-sm text-justice">
          The draw is sealed with these {data.entrants.length} players. Cancel the draw on the next tab to change who's in.
        </p>
      )}

      <div className="grid gap-px bg-ink-line sm:grid-cols-4">
        <Stat label="In the league" value={chosen.length} />
        <Stat label="Keepers" value={keepers} note={keepers < 6 ? `${6 - keepers} club${6 - keepers === 1 ? "" : "s"} without one` : undefined} />
        <Stat label="Pots" value={pots.length} />
        <Stat label="Squad size" value={chosen.length ? (lo === hi ? lo : `${lo}–${hi}`) : 0} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the squad"
          className="min-w-0 flex-1 border border-ink-line bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-mist focus:border-paper focus:outline-none"
        />
        {!locked && (
          <>
            <button type="button" className={btnGhost} onClick={() => { setSaved(false); setPicked(new Set(roster.map((p) => p.id))); }}>
              Select all
            </button>
            <button type="button" className={btnGhost} onClick={() => { setSaved(false); setPicked(new Set()); }}>
              Clear
            </button>
          </>
        )}
      </div>

      <ul className="mt-4 grid gap-px overflow-hidden border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p) => {
          const on = picked.has(p.id);
          return (
            <li key={p.id} className="relative">
              <label className={`flex items-center gap-3 px-4 py-3 ${locked ? "" : "cursor-pointer"} ${on ? "bg-ink-raised" : "bg-ink"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(p.id)} disabled={locked} className="h-4 w-4 accent-[var(--color-justice,#c9a85a)]" />
                <img src={p.photo} alt="" className={`h-9 w-9 rounded-full object-cover ${on ? "" : "opacity-50 grayscale"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${on ? "text-paper" : "text-paper-dim"}`}>{p.name}</span>
                  <span className="block text-xs text-mist">
                    {position(p)}
                    {gk.has(p.id) && p.position !== "GK" ? ` (league keeper, usually ${p.position})` : ""}
                    {p.membership === "guest" ? " · guest" : ""}
                  </span>
                </span>
                <span className="font-display text-xl text-paper-dim">{fmt(p.rating)}</span>
              </label>
              {on && p.position !== "GK" && (
                <button
                  type="button"
                  disabled={locked}
                  aria-pressed={gk.has(p.id)}
                  onClick={() => {
                    setSaved(false);
                    setGk((s) => {
                      const next = new Set(s);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  }}
                  className={`absolute right-14 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${gk.has(p.id) ? "bg-justice text-ink" : "border border-ink-line text-mist hover:text-paper"}`}
                  title="Plays in goal for the league only; squad position unchanged"
                >
                  GK
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!locked && (
        <div className="sticky bottom-20 mt-5 flex items-center justify-end gap-3 md:bottom-4">
          {saved && !dirty && <span className="text-sm text-win">Saved. The league site shows {chosen.length} players.</span>}
          <button type="button" className={`${btnPrimary} shadow-lg`} onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : `Save ${chosen.length} players`}
          </button>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="bg-ink px-4 py-4">
      <p className="text-xs text-mist">{label}</p>
      <p className="mt-1 font-display text-3xl text-paper">{value}</p>
      {note && <p className="text-xs text-justice">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- the draw */

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function useOfficialDraw(data: LeagueData) {
  const [draw, setDraw] = useState<DrawResult | null>(null);
  const seed = data.draw?.seed;
  useEffect(() => {
    if (!seed) return setDraw(null);
    let alive = true;
    void runDraw(seed, data.entrants).then((d) => alive && setDraw(d));
    return () => {
      alive = false;
    };
  }, [seed, data.entrants]);
  return draw;
}

function DrawTab({ data, act }: { data: LeagueData; act: Act }) {
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toLocalInput(d);
  });
  const [busy, setBusy] = useState(false);
  const draw = useOfficialDraw(data);

  async function seal() {
    setBusy(true);
    await act("/league/draw", "POST", { starts_at: new Date(startsAt).toISOString(), speed: 1 });
    setBusy(false);
  }

  async function cancel() {
    if (data.draw?.revealed) return;
    const msg = "Cancel the draw? The fingerprint is withdrawn and you can change who's in.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    await act("/league/draw", "DELETE");
    setBusy(false);
  }

  if (!data.draw) {
    return (
      <section className="mt-8 max-w-xl">
        <h2 className="font-display text-2xl text-paper">Seal the draw</h2>
        <p className="mt-2 text-sm text-paper-dim">
          Sealing freezes the {data.entrants.length} players marked in, and the server picks a secret seed. The league site
          shows the countdown and the seed's fingerprint straight away; the seed itself is revealed when the draw starts, and
          the draw plays live for everyone at the same moment. It takes about {Math.ceil((6 + buildPots(data.entrants).length * 3.5 + data.entrants.length * 6.6) / 60)} minutes.
        </p>
        <label className="mt-5 block text-sm text-paper-dim">
          Draw starts (your time)
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1.5 block w-full border border-ink-line bg-ink px-4 py-2.5 text-paper [color-scheme:dark] focus:border-paper focus:outline-none"
          />
        </label>
        <button type="button" className={`${btnPrimary} mt-5`} onClick={seal} disabled={busy || data.entrants.length < 6 || !startsAt}>
          Seal the draw
        </button>
        {data.entrants.length < 6 && <p className="mt-3 text-sm text-mist">Mark at least 6 players as in first.</p>}
      </section>
    );
  }

  const starts = new Date(data.draw.startsAt);
  return (
    <section className="mt-8">
      <div className="grid gap-px bg-ink-line sm:grid-cols-3">
        <Stat label="Status" value={data.draw.revealed ? "Teams locked" : "Sealed"} />
        <Stat label="Starts" value={starts.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} />
        <Stat label="Players" value={data.entrants.length} />
      </div>
      <p className="mt-5 text-sm text-paper-dim">
        Fingerprint <code className="block break-all text-xs text-paper">{data.draw.hash}</code>
      </p>
      {data.draw.seed && (
        <p className="mt-3 text-sm text-paper-dim">
          Seed <code className="text-xs text-paper">{data.draw.seed}</code>
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <a href={leagueUrl("#draw")} target="_blank" rel="noreferrer" className={btnPrimary}>
          Watch the draw
        </a>
        {!data.draw.revealed && (
          <button type="button" className={btnDanger} onClick={cancel} disabled={busy}>
            Cancel the draw
          </button>
        )}
      </div>

      {data.draw.revealed && <p className="mt-3 text-sm text-paper-dim">The official teams are locked. This draw cannot be cancelled or redrawn.</p>}

      {draw && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(draw.squads) as ClubId[]).map((id) => (
            <div key={id} className="border border-ink-line bg-ink-raised p-4">
              <p className="flex items-center gap-2 font-display text-xl text-paper">
                <ClubBadge id={id} size={26} /> {clubById.get(id)!.name}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-paper-dim">
                {draw.squads[id].map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      <span className="text-xs text-mist">{p.position}</span> {p.name}<CaptainBadge name={p.name} />
                    </span>
                    <span className="font-display text-paper">{fmt(p.rating)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ match day */

function MatchdayTab({ data, act }: { data: LeagueData; act: Act }) {
  const [night, setNight] = useState(data.liveNight ?? 1);
  const results = useResultsByNo(data.results);
  const draw = useOfficialDraw(data);
  const live = data.liveNight === night;
  const games = GAMES.filter((g) => g.night === night);

  return (
    <section className="mt-8">
      <div className="flex flex-wrap gap-2">
        {SEASON.map((n) => (
          <button
            key={n.number}
            type="button"
            onClick={() => setNight(n.number)}
            className={`${btn} ${night === n.number ? "bg-paper text-ink" : "border border-ink-line text-paper-dim"}`}
          >
            Sunday {n.number} <span className="font-normal opacity-70">{nightDate(n.number)}</span>
            {data.liveNight === n.number && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-loss" />}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border border-ink-line bg-ink-raised px-4 py-3">
        <p className="flex-1 text-sm text-paper-dim">
          {live
            ? "This match day is live. The league site shows it as on and refreshes scores every 10 seconds."
            : data.liveNight
              ? `Sunday ${data.liveNight} is the live match day.`
              : "No match day is live."}
        </p>
        {live ? (
          <button type="button" className={btnGhost} onClick={() => act("/league/matchday", "PUT", { night: null })}>
            End match day
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={() => act("/league/matchday", "PUT", { night })}>
            Start match day {night}
          </button>
        )}
      </div>

      <ol className="mt-5 space-y-3">
        {games.map((g) => (
          <MatchRow key={g.no} no={g.no} home={g.home} away={g.away} time={clockTime(g.start)} data={data} result={results.get(g.no)} draw={draw} act={act} />
        ))}
      </ol>
    </section>
  );
}

function MatchRow(props: {
  no: number;
  home: ClubId;
  away: ClubId;
  time: string;
  data: LeagueData;
  result: LeagueData["results"][number] | undefined;
  draw: DrawResult | null;
  act: Act;
}) {
  const { no, home, away, data, result, draw, act } = props;
  const [adding, setAdding] = useState<"home" | "away" | null>(null);
  const status = result?.status ?? "scheduled";
  const goals = data.goals.filter((g) => g.matchNo === no);
  const names = new Map(data.entrants.map((e) => [e.id, e.name]));
  const path = `/league/matches/${no}`;

  return (
    <li className={`border bg-ink-raised p-4 ${status === "live" ? "border-loss" : "border-ink-line"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-16 text-xs text-mist">
          {props.time}
          <br />
          Game {no}
        </span>
        <span className="flex flex-1 items-center justify-end gap-2 text-right text-sm text-paper">
          {clubById.get(home)!.name} <CrestButton id={home} open={adding === "home"} disabled={status === "final"} onClick={() => setAdding(adding === "home" ? null : "home")} />
        </span>
        <span className="w-20 text-center font-display text-3xl text-paper">
          {status === "scheduled" ? <span className="text-lg text-mist">vs</span> : `${result!.homeScore}–${result!.awayScore}`}
        </span>
        <span className="flex flex-1 items-center gap-2 text-sm text-paper">
          <CrestButton id={away} open={adding === "away"} disabled={status === "final"} onClick={() => setAdding(adding === "away" ? null : "away")} /> {clubById.get(away)!.name}
        </span>
      </div>

      {goals.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs text-paper-dim">
              <ClubBadge id={g.side === "home" ? home : away} size={16} />
              {g.playerId ? names.get(g.playerId) ?? "Unknown" : "Unknown"}
              {g.ownGoal && " (og)"}
              {g.assistPlayerId && <span className="text-mist">assist {names.get(g.assistPlayerId)}</span>}
              <button type="button" onClick={() => act(`/league/goals/${g.id}`, "DELETE")} className="text-loss" aria-label="Remove goal">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {status === "scheduled" && (
          <button type="button" className={btnPrimary} onClick={() => act(path, "PUT", { status: "live" })}>
            Kick off
          </button>
        )}
        {status !== "final" && (
          <>
            <button type="button" className={btnGhost} onClick={() => setAdding(adding === "home" ? null : "home")}>
              + {clubById.get(home)!.short} goal
            </button>
            <button type="button" className={btnGhost} onClick={() => setAdding(adding === "away" ? null : "away")}>
              + {clubById.get(away)!.short} goal
            </button>
          </>
        )}
        {status === "live" && (
          <button type="button" className={btnPrimary} onClick={() => act(path, "PUT", { status: "final" })}>
            Full time
          </button>
        )}
        {status === "final" && (
          <button type="button" className={btnGhost} onClick={() => act(path, "PUT", { status: "live" })}>
            Reopen
          </button>
        )}
        {status !== "scheduled" && (
          <button
            type="button"
            className={btnDanger}
            onClick={() => window.confirm("Reset this game? Its goals are removed.") && act(path, "PUT", { status: "scheduled" })}
          >
            Reset
          </button>
        )}
      </div>

      {adding && (
        <GoalForm
          side={adding}
          club={adding === "home" ? home : away}
          other={adding === "home" ? away : home}
          draw={draw}
          entrants={data.entrants}
          onCancel={() => setAdding(null)}
          onSave={async (body) => {
            if (await act(`${path}/goals`, "POST", { side: adding, ...body })) setAdding(null);
          }}
        />
      )}
    </li>
  );
}

/** A club's crest in a match row: tap it to add a goal for that club. */
function CrestButton({ id, open, disabled, onClick }: { id: ClubId; open: boolean; disabled: boolean; onClick: () => void }) {
  if (disabled) return <ClubBadge id={id} size={28} />;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      aria-label={`Add a ${clubById.get(id)!.name} goal`}
      title={`Add a ${clubById.get(id)!.short} goal`}
      className={`inline-flex rounded-full transition-transform hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper ${open ? "ring-2 ring-paper ring-offset-2 ring-offset-ink-raised" : ""}`}
    >
      <ClubBadge id={id} size={28} />
    </button>
  );
}

function GoalForm(props: {
  side: "home" | "away";
  club: ClubId;
  other: ClubId;
  draw: DrawResult | null;
  entrants: Entrant[];
  onCancel: () => void;
  onSave: (body: { player_id: number | null; assist_player_id: number | null; own_goal: boolean }) => Promise<void>;
}) {
  const [scorer, setScorer] = useState("");
  const [assist, setAssist] = useState("");
  const [ownGoal, setOwnGoal] = useState(false);
  const squad = (id: ClubId) => props.draw?.squads[id] ?? props.entrants;
  const scorers = squad(ownGoal ? props.other : props.club);
  const select = "min-w-0 flex-1 border border-ink-line bg-ink px-3 py-2 text-sm text-paper [color-scheme:dark]";

  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        void props.onSave({ player_id: scorer ? Number(scorer) : null, assist_player_id: !ownGoal && assist ? Number(assist) : null, own_goal: ownGoal });
      }}
    >
      <span className="flex items-center gap-2 text-sm text-paper">
        <ClubBadge id={props.club} size={22} /> goal
      </span>
      <select value={scorer} onChange={(e) => setScorer(e.target.value)} className={select} aria-label="Scorer">
        <option value="">Scorer not known</option>
        {scorers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {!ownGoal && (
        <select value={assist} onChange={(e) => setAssist(e.target.value)} className={select} aria-label="Assist">
          <option value="">No assist</option>
          {squad(props.club)
            .filter((p) => String(p.id) !== scorer)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      )}
      <label className="flex items-center gap-2 text-sm text-paper-dim">
        <input type="checkbox" checked={ownGoal} onChange={(e) => { setOwnGoal(e.target.checked); setScorer(""); }} />
        Own goal
      </label>
      <button type="submit" className={btnPrimary}>
        Add goal
      </button>
      <button type="button" className={btnGhost} onClick={props.onCancel}>
        Cancel
      </button>
    </form>
  );
}
