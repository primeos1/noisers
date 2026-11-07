import { useCallback, useEffect, useMemo, useState } from "react";
import logo from "../assets/brand/logo-white.png";
import { clockTime, clubs, KICK_OFF, type ClubId } from "../lib/league";
import { ClubBadge, Shirt } from "./ClubBadge";
import { clubById, defaultNight, GAMES, nightDate, SEASON, standings, topScorers, useLeague, useResultsByNo, type LeagueData } from "./data";
import { CLUB_ORDER, DEMO_PLAYERS, buildTimeline, fmt, runDraw, sha256Hex, verifyDraw, type DrawResult, type Entrant } from "./draw";
import DrawStage from "./DrawStage";
import { AwardsPage, PlayersPage } from "./PlayersAwards";

const MAIN_SITE = "https://noisersfc.com";

interface Demo {
  seed: string;
  start: number;
  speed: number;
  /** Which players: the real marked list, or stand-ins. */
  pl: "live" | "demo";
}

function readDemo(): Demo | null {
  const q = new URLSearchParams(window.location.search);
  const seed = q.get("seed");
  const start = Number(q.get("start"));
  if (!seed || !Number.isFinite(start) || start <= 0) return null;
  const speed = [1, 3, 8].includes(Number(q.get("speed"))) ? Number(q.get("speed")) : 1;
  return { seed, start, speed, pl: q.get("pl") === "live" ? "live" : "demo" };
}

function writeDemo(demo: Demo | null) {
  const url = new URL(window.location.href);
  for (const k of ["seed", "start", "speed", "pl"]) url.searchParams.delete(k);
  if (demo) {
    url.searchParams.set("seed", demo.seed);
    url.searchParams.set("start", String(Math.round(demo.start)));
    url.searchParams.set("speed", String(demo.speed));
    url.searchParams.set("pl", demo.pl);
  }
  window.history.replaceState(null, "", url);
}

function useTicker(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

/** Runs the draw for a seed and player list (async: SHA-256 is). */
function useDraw(seed: string | null | undefined, entrants: Entrant[] | null) {
  const [result, setResult] = useState<{ key: string; draw: DrawResult } | null>(null);
  const key = seed && entrants ? `${seed}|${entrants.map((e) => e.id).join(",")}` : "";
  useEffect(() => {
    if (!key || !seed || !entrants) return;
    let alive = true;
    void runDraw(seed, entrants).then((draw) => alive && setResult({ key, draw }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result?.key === key ? result.draw : null;
}

const lagosTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

type Page = "home" | "players" | "awards";

function currentPage(): Page {
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  return path === "/players" ? "players" : path === "/awards" ? "awards" : "home";
}

const pageTitles: Record<Page, string> = {
  home: "The Noisers League",
  players: "Players | The Noisers League",
  awards: "Awards | The Noisers League",
};

export default function LeagueSite() {
  const [page] = useState<Page>(currentPage);
  useEffect(() => {
    document.title = pageTitles[page];
  }, [page]);
  const { data, error, now } = useLeague();
  const [demo, setDemo] = useState<Demo | null>(readDemo);
  const [demoHash, setDemoHash] = useState<string | null>(null);
  const [drawLive, setDrawLive] = useState(false);

  const officialEntrants = data?.draw ? data.entrants : null;
  const official = useDraw(data?.draw?.seed, officialEntrants);
  // Demos run on the real league players (faces and ratings) whenever there
  // are enough of them; the stand-ins only cover an empty league.
  const demoEntrants = demo && data ? (data.entrants.length >= 6 ? data.entrants : DEMO_PLAYERS) : null;
  const demoDraw = useDraw(demo?.seed, demoEntrants);

  useEffect(() => {
    if (demo) void sha256Hex(demo.seed).then(setDemoHash);
    else setDemoHash(null);
  }, [demo]);

  const startDemo = useCallback(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const seed = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const next: Demo = { seed, start: now() + 5000, speed: demo?.speed ?? 1, pl: data && data.entrants.length >= 6 ? "live" : "demo" };
    writeDemo(next);
    setDemo(next);
    document.getElementById("draw")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [now, demo, data]);

  const changeSpeed = useCallback(
    (speed: number) => {
      if (!demo) return;
      // Keep the current place: same elapsed draw-time, new rate.
      const elapsed = (now() - demo.start) * demo.speed;
      const next = { ...demo, speed, start: now() - elapsed / speed };
      writeDemo(next);
      setDemo(next);
    },
    [demo, now],
  );

  const leaveDemo = useCallback(() => {
    writeDemo(null);
    setDemo(null);
  }, []);

  const watchLink = demo
    ? window.location.href
    : `${window.location.origin}/#draw`;

  // The page renders after the browser tried to jump to #draw, so jump once data is in.
  const loaded = !!data;
  useEffect(() => {
    if (loaded && window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
  }, [loaded]);

  const anyMatchLive = !!data?.results.some((r) => r.status === "live");
  const officialStart = data?.draw ? Date.parse(data.draw.startsAt) : null;
  const officialSpeed = data?.draw?.speed ?? 1;

  // Where the official draw is: still to come (practice draws allowed),
  // playing (practice off), or done (the draw screen goes for good).
  useTicker(1000);
  const officialEnd = official && officialStart != null ? officialStart + (buildTimeline(official).total / officialSpeed) * 1000 : null;
  const stage: "open" | "live" | "done" =
    officialStart == null || now() < officialStart ? "open" : officialEnd != null && now() >= officialEnd ? "done" : "live";

  // A practice draw gives way to the real one.
  useEffect(() => {
    if (stage !== "open" && demo) leaveDemo();
  }, [stage, demo, leaveDemo]);
  const showDemo = stage === "open" ? demo : null;

  const fairPlay = (
    <FairPlay
      seed={showDemo ? showDemo.seed : (data?.draw?.seed ?? "")}
      hash={showDemo ? (demoHash ?? "") : (data?.draw?.hash ?? "")}
      entrants={showDemo ? demoEntrants : officialEntrants}
      expected={showDemo ? demoDraw : official}
      isDemo={!!showDemo}
    />
  );

  const footer = (
    <footer className="nl-footer">
      <img src={logo} alt="" width={36} height={36} />
      <p>
        The Noisers League is played by the squad of <a href={MAIN_SITE}>Noisers FC</a>, Lekki, Lagos.
      </p>
    </footer>
  );
  const errorNote = error && !data && <p className="nl-error" role="alert">{error} Refresh to try again.</p>;

  // Players and Awards are pages of their own; the squads only reach them
  // once the official draw has played, so they can't spoil it.
  if (page !== "home") {
    const draw = stage === "done" ? official : null;
    return (
      <div className="nl-root">
        <Nav live={anyMatchLive} done={stage === "done"} drawLive={false} page={page} />
        {errorNote}
        {page === "players" ? <PlayersPage draw={draw} data={data} /> : <AwardsPage draw={draw} data={data} />}
        {footer}
      </div>
    );
  }

  return (
    <div className="nl-root">
      <Nav live={drawLive || anyMatchLive} done={stage === "done"} drawLive={drawLive} page={page} />
      <Hero data={data} done={stage === "done"} />
      {errorNote}

      {stage === "done" ? (
        // The official league page: the draw is history.
        <>
          <Fixtures data={data} />
          <Table data={data} />
          <Clubs official={official} startMs={officialStart} speed={officialSpeed} now={now} />
          {fairPlay}
        </>
      ) : (
        <>
          <DrawStage
            result={showDemo ? demoDraw : official}
            startMs={showDemo ? showDemo.start : officialStart}
            speed={showDemo ? showDemo.speed : officialSpeed}
            hash={showDemo ? demoHash : (data?.draw?.hash ?? null)}
            mode={showDemo ? "demo" : data?.draw ? "official" : "none"}
            allowDemo={stage === "open"}
            entrantCount={data?.entrants.length ?? 0}
            now={now}
            onStartDemo={startDemo}
            onSpeed={changeSpeed}
            onLeaveDemo={leaveDemo}
            watchLink={watchLink}
            onLive={setDrawLive}
          />
          <Clubs official={official} startMs={officialStart} speed={officialSpeed} now={now} />
          <Fixtures data={data} />
          <Table data={data} />
          {fairPlay}
        </>
      )}

      {footer}
    </div>
  );
}

/* ------------------------------------------------------------------ nav */

// Sections of the home page, then the two pages of their own.
const leagueSections = [
  ["fixtures", "Fixtures"],
  ["table", "Table"],
  ["clubs", "Clubs"],
] as const;

const drawSections = [
  ["draw", "The Draw"],
  ["clubs", "Clubs"],
  ["fixtures", "Fixtures"],
  ["table", "Table"],
] as const;

function Nav({ live, done, drawLive, page }: { live: boolean; done: boolean; drawLive: boolean; page: Page }) {
  const home = page === "home" ? "" : "/";
  const links: { href: string; label: string; current?: boolean }[] = [
    ...(done ? leagueSections : drawSections).map(([id, label]) => ({ href: `${home}#${id}`, label })),
    { href: "/players", label: "Players", current: page === "players" },
    { href: "/awards", label: "Awards", current: page === "awards" },
    { href: `${home}#fair-play`, label: "Fair Play" },
  ];
  return (
    <header className="nl-nav">
      <a href={page === "home" ? "#top" : "/"} className="nl-brand">
        <img src={logo} alt="Noisers FC" width={30} height={30} />
        <span>The Noisers League</span>
      </a>
      {live && (
        <a href={`${home}${drawLive ? "#draw" : "#fixtures"}`} className="nl-live-pill">
          Live
        </a>
      )}
      <nav aria-label="Sections">
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} aria-current={l.current ? "page" : undefined}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

/* ----------------------------------------------------------------- hero */

function Hero({ data, done }: { data: LeagueData | null; done: boolean }) {
  useTicker(1000);
  const left = Math.max(0, KICK_OFF.getTime() - Date.now());
  const parts = [
    [Math.floor(left / 86_400_000), "days"],
    [Math.floor((left % 86_400_000) / 3_600_000), "hours"],
    [Math.floor((left % 3_600_000) / 60_000), "mins"],
    [Math.floor((left % 60_000) / 1000), "secs"],
  ] as const;
  const players = data?.entrants.length ?? 0;
  const drawAt = data?.draw && !data.draw.revealed ? lagosTime(data.draw.startsAt) : null;

  return (
    <section id="top" className="nl-hero">
      <div className="nl-scarf" aria-hidden="true">
        {CLUB_ORDER.map((id) => {
          const c = clubById.get(id)!;
          return <span key={id} style={{ background: c.colours.stripe ? `repeating-linear-gradient(90deg, ${c.colours.primary} 0 14px, ${c.colours.stripe} 14px 28px)` : c.colours.primary }} />;
        })}
      </div>
      <div className="nl-hero-inner">
        <p className="nl-season">Season one</p>
        <h1 className="nl-title">
          <span>The Noisers</span>
          <span>League</span>
        </h1>
        <p className="nl-shout">Let's make some noise!</p>

        <div className="nl-kickoff">
          {left > 0 ? (
            <>
              <p className="nl-kickoff-label">Kick-off, Sunday 15 November, 9 PM</p>
              <div className="nl-kickoff-clock" role="timer" aria-label="Time to kick-off">
                {parts.map(([n, label]) => (
                  <div key={label}>
                    <span>{String(n).padStart(2, "0")}</span>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="nl-kickoff-label">The season is under way.</p>
          )}
        </div>

        {done && <NextUp data={data} />}

        {!done && drawAt && (
          <a href="#draw" className="nl-draw-notice">
            The draw goes live {drawAt}. Watch it here.
          </a>
        )}

        <ul className="nl-chips">
          <li><strong>6</strong> clubs</li>
          {players > 0 && <li><strong>{players}</strong> players</li>}
          <li><strong>3×</strong> every opponent</li>
          <li><strong>5</strong> Sundays</li>
          <li>Nobody picks their own team</li>
        </ul>
      </div>
    </section>
  );
}

/** The live game, or the next one to be played. */
function NextUp({ data }: { data: LeagueData | null }) {
  const results = useResultsByNo(data?.results);
  const live = GAMES.filter((g) => results.get(g.no)?.status === "live");
  const next = GAMES.find((g) => (results.get(g.no)?.status ?? "scheduled") === "scheduled");
  const show = live.length ? live : next ? [next] : [];
  if (!show.length) return <p className="nl-nextup-label">Season one is complete. See the awards below.</p>;
  return (
    <a href="#fixtures" className="nl-nextup">
      <p className="nl-nextup-label">
        {live.length ? <span className="nl-live-pill">Live now</span> : `Next up: Sunday ${show[0].night}, ${nightDate(show[0].night)}, ${clockTime(show[0].start)}`}
      </p>
      {show.map((g) => {
        const r = results.get(g.no);
        return (
          <div key={g.no} className="nl-nextup-game">
            <ClubBadge id={g.home} size={36} />
            <span><b className="is-long">{clubById.get(g.home)!.name}</b><b className="is-short">{clubById.get(g.home)!.short}</b></span>
            <strong>{r && r.status !== "scheduled" ? `${r.homeScore} – ${r.awayScore}` : "vs"}</strong>
            <span><b className="is-long">{clubById.get(g.away)!.name}</b><b className="is-short">{clubById.get(g.away)!.short}</b></span>
            <ClubBadge id={g.away} size={36} />
          </div>
        );
      })}
    </a>
  );
}

/* ---------------------------------------------------------------- clubs */

function Clubs({ official, startMs, speed, now }: { official: DrawResult | null; startMs: number | null; speed: number; now: () => number }) {
  useTicker(5000);
  const finished = official && startMs != null && now() >= startMs + (buildTimeline(official).total / speed) * 1000;
  return (
    <section id="clubs" className="nl-section" aria-labelledby="clubs-title">
      <h2 id="clubs-title" className="nl-h2">The clubs</h2>
      <p className="nl-lede">Six kits, six names. Squads are filled by the draw.</p>
      <div className="nl-clubs">
        {clubs.map((c) => {
          const squad = finished ? official.squads[c.id] : null;
          const avg = squad?.length ? fmt(squad.reduce((s, p) => s + p.rating, 0) / squad.length) : null;
          return (
            <article key={c.id} className="nl-club" style={{ "--c1": c.colours.primary, "--glow": c.colours.glow } as React.CSSProperties}>
              <Shirt id={c.id} className="nl-club-shirt" />
              <div>
                <h3 className="nl-club-name">{c.name}</h3>
              </div>
              {squad ? (
                <div className="nl-club-squad">
                  <p className="nl-muted">Squad, average {avg}</p>
                  <ul>
                    {[...squad].sort((a, b) => b.rating - a.rating).map((p) => (
                      <li key={p.id}>
                        <span className="nl-slot-pos">{p.position}</span>
                        {p.name}
                        <span className="nl-ovr">{fmt(p.rating)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="nl-muted">Squad decided at the draw.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- fixtures */

function Fixtures({ data }: { data: LeagueData | null }) {
  const [night, setNight] = useState<number | null>(null);
  const shown = night ?? defaultNight(data);
  const results = useResultsByNo(data?.results);
  const names = useMemo(() => new Map((data?.entrants ?? []).map((e) => [e.id, e.name])), [data?.entrants]);

  return (
    <section id="fixtures" className="nl-section" aria-labelledby="fixtures-title">
      <h2 id="fixtures-title" className="nl-h2">Fixtures</h2>
      <p className="nl-lede">Nine games a Sunday, 15 minutes each, kicking off every 20 minutes from 9 PM.</p>
      <div className="nl-tabs" role="tablist" aria-label="Sundays">
        {SEASON.map((n) => (
          <button
            key={n.number}
            type="button"
            role="tab"
            aria-selected={shown === n.number}
            className={shown === n.number ? "is-active" : ""}
            onClick={() => setNight(n.number)}
          >
            <span>Sunday {n.number}</span>
            <small>{nightDate(n.number)}</small>
            {data?.liveNight === n.number && <i className="nl-dot" aria-label="Live" />}
          </button>
        ))}
      </div>
      <ol className="nl-fixtures" role="tabpanel">
        {GAMES.filter((g) => g.night === shown).map((g) => {
          const r = results.get(g.no);
          const goals = (data?.goals ?? []).filter((x) => x.matchNo === g.no);
          const scorer = (side: "home" | "away") =>
            goals
              .filter((x) => x.side === side)
              .map((x) => `${x.playerId ? (names.get(x.playerId) ?? "Unknown") : "Unknown"}${x.ownGoal ? " (og)" : ""}`)
              .join(", ");
          return (
            <li key={g.no} className={`nl-fixture is-${r?.status ?? "scheduled"}`}>
              <span className="nl-fixture-time">{clockTime(g.start)}</span>
              <Side id={g.home} />
              <span className="nl-score">
                {r && r.status !== "scheduled" ? (
                  <>
                    {r.homeScore}
                    <i>–</i>
                    {r.awayScore}
                  </>
                ) : (
                  <i>vs</i>
                )}
              </span>
              <Side id={g.away} away />
              <span className="nl-fixture-state">
                {r?.status === "live" ? <span className="nl-live-pill">Live</span> : r?.status === "final" ? "FT" : ""}
              </span>
              {goals.length > 0 && (
                <p className="nl-scorers">
                  <span>{scorer("home")}</span>
                  <span>{scorer("away")}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
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

/* ---------------------------------------------------------------- table */

function Table({ data }: { data: LeagueData | null }) {
  const rows = standings(data?.results ?? []);
  const names = new Map((data?.entrants ?? []).map((e) => [e.id, e.name]));
  const scorers = topScorers(data?.goals ?? []);
  return (
    <section id="table" className="nl-section" aria-labelledby="table-title">
      <h2 id="table-title" className="nl-h2">League table</h2>
      <div className="nl-table-grid">
        <div className="nl-table-wrap">
          <table className="nl-table">
            <thead>
              <tr>
                <th scope="col" className="is-pos">Pos</th>
                <th scope="col" className="is-club">Club</th>
                <th scope="col">P</th>
                <th scope="col">W</th>
                <th scope="col">D</th>
                <th scope="col">L</th>
                <th scope="col" className="is-wide">GF</th>
                <th scope="col" className="is-wide">GA</th>
                <th scope="col">GD</th>
                <th scope="col">Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.club}>
                  <td className="is-pos">{i + 1}</td>
                  <th scope="row" className="is-club">
                    <ClubBadge id={r.club} size={24} />
                    <span>{clubById.get(r.club)!.name}</span>
                  </th>
                  <td>{r.p}</td>
                  <td>{r.w}</td>
                  <td>{r.d}</td>
                  <td>{r.l}</td>
                  <td className="is-wide">{r.gf}</td>
                  <td className="is-wide">{r.ga}</td>
                  <td>{r.gf - r.ga > 0 ? `+${r.gf - r.ga}` : r.gf - r.ga}</td>
                  <td className="is-pts">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nl-muted nl-note">Win 3, draw 1. Games count once they finish.</p>
        </div>
        <div className="nl-scorers-board">
          <h3 className="nl-h3">Top scorers</h3>
          {scorers.length === 0 ? (
            <p className="nl-muted">The first goal goes in on 15 November.</p>
          ) : (
            <ol>
              {scorers.map(([id, n]) => (
                <li key={id}>
                  <span>{names.get(id) ?? "Unknown"}</span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ fair play */

function FairPlay(props: { seed: string; hash: string; entrants: Entrant[] | null; expected: DrawResult | null; isDemo: boolean }) {
  const [seed, setSeed] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<null | { hashMatches: boolean; picksMatch: boolean; picks: number; hash: string }>(null);

  // Fill the boxes from the current draw, without overwriting typing.
  useEffect(() => setSeed((s) => s || props.seed), [props.seed]);
  useEffect(() => setHash((h) => h || props.hash), [props.hash]);

  async function verify() {
    if (!props.entrants) return;
    setBusy(true);
    try {
      setOutcome(await verifyDraw(seed, hash, props.entrants, props.expected ?? undefined));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="fair-play" className="nl-section" aria-labelledby="fair-title">
      <h2 id="fair-title" className="nl-h2">Fair play</h2>
      <div className="nl-fair">
        <ol className="nl-steps">
          <li>
            <h3>Sealed</h3>
            <p>
              When the committee confirms who's in, the server picks a secret seed and publishes only its SHA-256 fingerprint.
              The player list is frozen at the same moment. Nobody, not even the committee, sees the seed.
            </p>
          </li>
          <li>
            <h3>Revealed</h3>
            <p>
              At the start of the draw the seed is made public. Every phone runs the same draw from it, so everyone sees the
              same pick at the same second.
            </p>
          </li>
          <li>
            <h3>Checked</h3>
            <p>
              Hash the seed and it must match the fingerprint published beforehand. Re-run the draw with it and every pick must
              match. If either fails, the draw was tampered with.
            </p>
          </li>
        </ol>

        <form
          className="nl-verify"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <h3 className="nl-h3">Verify the draw{props.isDemo ? " (demo)" : ""}</h3>
          <label>
            Seed
            <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Revealed when the draw starts" spellCheck={false} />
          </label>
          <label>
            Published fingerprint
            <input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="SHA-256, 64 characters" spellCheck={false} />
          </label>
          <button type="submit" className="nl-btn" disabled={!seed.trim() || !hash.trim() || !props.entrants || busy}>
            {busy ? "Checking" : "Verify"}
          </button>
          {!props.entrants && <p className="nl-muted">You can verify once a draw has been sealed.</p>}
          {outcome && (
            <div className={`nl-verdict ${outcome.hashMatches && outcome.picksMatch ? "is-pass" : "is-fail"}`} role="status">
              <p>{outcome.hashMatches ? "Fingerprint matches the seed." : "Fingerprint does not match this seed."}</p>
              <p>
                {outcome.picksMatch
                  ? `All ${outcome.picks} picks match the re-run.`
                  : "The re-run gives different picks."}
              </p>
              <p className="nl-muted">
                SHA-256 of the seed: <code>{outcome.hash}</code>
              </p>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
