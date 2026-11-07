import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ClubId } from "../lib/league";
import defaultPhoto from "../assets/player-default.svg";
import { BEATS, buildTimeline, CLUB_ORDER, COUNT_FROM, countAt, fmt, momentAt, rouletteAt, type DrawResult, type Entrant, type Moment } from "./draw";

const photoOf = (p: Entrant) => p.photoUrl || defaultPhoto;
import { clubById } from "./data";
import { ClubBadge } from "./ClubBadge";
import { CaptainBadge } from "./CaptainBadge";

/* --------------------------------------------------------------- sound */

class Synth {
  private ctx: AudioContext | null = null;
  on = false;

  enable(on: boolean) {
    this.on = on;
    if (on && !this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = Ctx ? new Ctx() : null;
    }
    void this.ctx?.resume();
  }

  private beep(freq: number, dur: number, gain: number, type: OscillatorType = "square", at = 0) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  tick(high = false) {
    this.beep(high ? 1500 : 1100, 0.03, 0.04);
  }

  chime() {
    [784, 988, 1319].forEach((f, i) => this.beep(f, 0.5, 0.06, "sine", i * 0.08));
  }
}

/* ---------------------------------------------------------------- view */

interface View {
  moment: Moment;
  /** 0 roulette, 1 pulled, 2 flipped, 3 counting, 4 revealed, 5 flying away. */
  beat: number;
  lit: ClubId | null;
  step: number;
  count: number;
  /** Whole seconds to the start, for the countdown. */
  countdown: number;
}

function beatAt(t: number) {
  if (t >= BEATS.fly) return 5;
  if (t >= BEATS.reveal) return 4;
  if (t >= BEATS.countFrom) return 3;
  if (t >= BEATS.flip) return 2;
  if (t >= BEATS.pull) return 1;
  return 0;
}

const viewKey = (v: View) =>
  `${v.moment.phase}|${"round" in v.moment ? v.moment.round : ""}|${"pick" in v.moment ? v.moment.pick : ""}|${v.moment.done}|${v.beat}|${v.lit}|${v.step}|${v.count}|${v.countdown}`;

export interface DrawStageProps {
  result: DrawResult | null;
  startMs: number | null;
  speed: number;
  hash: string | null;
  mode: "official" | "demo" | "none";
  /** Practice draws are off once the official one has started. */
  allowDemo: boolean;
  entrantCount: number;
  now: () => number;
  onStartDemo: () => void;
  onSpeed: (speed: number) => void;
  onLeaveDemo: () => void;
  watchLink: string;
  onLive?: (live: boolean) => void;
}

function clock(seconds: number) {
  const s = Math.max(0, seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export default function DrawStage(props: DrawStageProps) {
  const { result, startMs, speed, hash, mode, now, onLive } = props;
  const timeline = useMemo(() => (result ? buildTimeline(result) : null), [result]);
  const total = result?.picks.length ?? 0;
  const [view, setView] = useState<View | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const synth = useRef(new Synth());
  const prev = useRef<View | null>(null);

  // One rAF loop works out the moment from the clock; React only hears
  // about it when something on screen would change.
  useEffect(() => {
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      let v: View | null = null;
      if (startMs != null) {
        const elapsed = ((now() - startMs) / 1000) * speed;
        const countdown = Math.ceil((startMs - now()) / 1000);
        if (timeline && result) {
          const moment = momentAt(timeline, elapsed, total);
          let beat = 0;
          let lit: ClubId | null = null;
          let step = 0;
          let count = COUNT_FROM;
          if (moment.phase === "pick") {
            const pick = result.picks[moment.pick];
            const round = result.rounds[moment.round];
            beat = beatAt(moment.t);
            const r = rouletteAt(moment.t, round.order.slice(pick.slot), pick.club);
            lit = r.club;
            step = r.step;
            count = countAt(moment.t, pick.player.rating);
          }
          v = { moment, beat, lit, step, count, countdown };
        } else {
          // Official draw whose seed isn't public yet.
          v = { moment: { phase: "before", untilStart: Math.max(0, -elapsed), done: 0 }, beat: 0, lit: null, step: 0, count: COUNT_FROM, countdown };
        }
      }
      const key = v ? viewKey(v) : "none";
      if (key !== lastKey) {
        lastKey = key;
        setView(v);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [startMs, speed, timeline, result, total, now]);

  // Sounds follow the view as it changes, never on the first frame.
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!p || !view || view.moment.phase !== "pick" || p.moment.phase !== "pick") return;
    if (p.moment.pick !== view.moment.pick) return;
    if (view.step !== p.step && view.beat === 0) synth.current.tick();
    // A tick per tenth, not per hundredth, or it's a buzz.
    if (Math.floor(view.count * 10) !== Math.floor(p.count * 10) && view.beat === 3) synth.current.tick(true);
    if (view.beat === 4 && p.beat < 4) synth.current.chime();
  }, [view]);

  // Load every face before the draw needs it, so cards never flip to a blank.
  useEffect(() => {
    result?.picks.forEach((p) => {
      const img = new Image();
      img.src = photoOf(p.player);
    });
  }, [result]);

  const phase = view?.moment.phase ?? "none";
  const live = phase === "intro" || phase === "title" || phase === "pick";
  useEffect(() => onLive?.(live && mode === "official"), [live, mode, onLive]);

  const done = view?.moment.done ?? 0;
  const pickNo = view && "pick" in view.moment ? view.moment.pick : null;
  const roundNo = view && "round" in view.moment ? view.moment.round : phase === "after" ? (result?.rounds.length ?? 1) - 1 : 0;
  const round = result?.rounds[roundNo];
  const pick = pickNo != null ? result?.picks[pickNo] : undefined;
  const beat = view?.beat ?? 0;

  // Face-down cards left in the pot: those not yet pulled this round.
  const pulledThisRound = result ? result.picks.filter((p) => p.round === roundNo && (pickNo == null ? p.n < done : p.n < pickNo || (p.n === pickNo && beat >= 1))).length : 0;
  const potLeft = round ? round.order.length - pulledThisRound : 0;
  const waiting = round && pick ? round.order.slice(pick.slot) : [];
  const pickedThisRound = new Set(result?.picks.filter((p) => p.round === roundNo && p.n < (pickNo ?? done)).map((p) => p.club));

  const placed = result ? result.picks.slice(0, done) : [];
  const newest = done > 0 ? done - 1 : -1;
  const latest = placed.slice(-7).reverse();
  const shown = phase === "after" ? total : done;
  const progress = total ? shown / total : 0;
  const slots = result ? Math.max(...CLUB_ORDER.map((c) => result.squads[c].length)) : 8;

  function toggleSound() {
    synth.current.enable(!soundOn);
    setSoundOn(!soundOn);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(props.watchLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", props.watchLink);
    }
  }

  const status =
    mode === "none"
      ? "Not scheduled yet"
      : phase === "before"
        ? startMs && now() >= startMs
          ? "Revealing the seed"
          : "Starts soon"
        : phase === "after"
          ? "Squads locked"
          : phase === "intro"
            ? "Underway"
            : `Pick ${Math.min(total, (pickNo ?? done) + 1)} of ${total}`;

  return (
    <section id="draw" className="nl-section nl-draw" aria-labelledby="draw-title">
      <div className="nl-draw-head">
        <div>
          <h2 id="draw-title" className="nl-h2">The live draw</h2>
          <p className="nl-draw-status">
            {live && <span className="nl-live-pill">Live</span>}
            {mode === "demo" && <span className="nl-demo-pill">Demo</span>}
            <span>{status}</span>
          </p>
        </div>
        <button type="button" className="nl-sound" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div className="nl-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={shown} aria-label="Picks made">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className="nl-draw-grid">
        <div className="nl-stage" data-phase={phase}>
          <div className="nl-floodlights" aria-hidden="true" />

          <div className="nl-roulette" aria-hidden={phase !== "pick"}>
            {CLUB_ORDER.map((id) => (
              <div
                key={id}
                className={`nl-roulette-club ${view?.lit === id ? "is-lit" : ""} ${waiting.includes(id) ? "is-waiting" : ""} ${pickedThisRound.has(id) ? "is-done" : ""} ${beat >= 1 && pick?.club === id ? "is-chosen" : ""}`}
              >
                <ClubBadge id={id} size={44} />
                <span>{clubById.get(id)!.short}</span>
              </div>
            ))}
          </div>

          <div className="nl-pot">
            <p className="nl-pot-label">
              {round ? (
                <>
                  <strong>{round.pot.label}</strong> rated {fmt(round.pot.low)}–{fmt(round.pot.high)}
                </>
              ) : (
                "The pots"
              )}
            </p>
            <div className={`nl-pot-cards ${phase === "pick" && beat === 0 ? "is-shuffling" : ""}`}>
              {Array.from({ length: Math.max(0, potLeft) }, (_, i) => (
                <span key={i} className="nl-facedown" style={{ "--i": i } as CSSProperties} />
              ))}
            </div>
          </div>

          {pick && beat >= 1 && <DrawCard key={pick.n} pick={pick} beat={beat} count={view!.count} potLabel={round!.pot.label} />}

          {phase === "none" && (
            <div className="nl-overlay">
              <p className="nl-overlay-big">The draw is coming</p>
              <p className="nl-overlay-sub">
                {props.entrantCount > 0
                  ? `${props.entrantCount} Noisers are in so far. The committee will announce when the draw goes live.`
                  : "The committee is confirming who's in. The draw goes live once the list is sealed."}
              </p>
            </div>
          )}
          {phase === "before" && (
            <div className="nl-overlay">
              {startMs && now() >= startMs ? (
                <p className="nl-overlay-big">Revealing the seed</p>
              ) : (
                <>
                  <p className="nl-overlay-kicker">{mode === "demo" ? "Demo draw starts in" : "The draw starts in"}</p>
                  <p className="nl-countdown">{clock(view?.countdown ?? 0)}</p>
                </>
              )}
              {hash && (
                <p className="nl-fingerprint">
                  Sealed fingerprint <code>{hash}</code>
                </p>
              )}
            </div>
          )}
          {phase === "intro" && (
            <div className="nl-overlay is-soft">
              <p className="nl-overlay-big">{total} players. Six clubs.</p>
              <p className="nl-overlay-sub">Nobody picks their own team. The seed decides, and you can check it.</p>
            </div>
          )}
          {phase === "title" && round && (
            <div className="nl-overlay nl-title-card" key={`t${roundNo}`}>
              <p className="nl-overlay-big">{round.pot.label}</p>
              <p className="nl-title-meta">
                Rated {fmt(round.pot.low)}–{fmt(round.pot.high)}
              </p>
              <p className="nl-overlay-sub">
                {new Set(round.order).size < round.order.length ? "Fixed teammates and permanent transfers apply" : round.order.length === 6 ? "Every club gets exactly one" : `${round.order.length} players, so the smallest squads pick first`}
              </p>
            </div>
          )}
          {phase === "after" && (
            <div className="nl-overlay is-final">
              <p className="nl-overlay-big">Squads locked</p>
              <p className="nl-title-meta">No hiding.</p>
            </div>
          )}
        </div>

        <aside className="nl-latest" aria-label="Latest picks">
          <h3 className="nl-h3">Latest picks</h3>
          {latest.length === 0 ? (
            <p className="nl-muted">Picks land here as they're drawn.</p>
          ) : (
            <ol>
              {latest.map((p) => (
                <li key={p.n} className={p.n === newest ? "is-new" : ""}>
                  <img src={photoOf(p.player)} alt="" className="nl-face" width={32} height={32} />
                  <span className="nl-latest-name">{p.player.name}<CaptainBadge name={p.player.name} /></span>
                  <ClubBadge id={p.club} size={22} />
                  <span className="nl-ovr">{fmt(p.player.rating)}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <div className="nl-board" aria-label="Squads">
        {CLUB_ORDER.map((id) => {
          const c = clubById.get(id)!;
          const squad = placed.filter((p) => p.club === id);
          const avg = squad.length ? squad.reduce((s, p) => s + p.player.rating, 0) / squad.length : null;
          return (
            <div key={id} className="nl-board-col">
              <div className="nl-board-head">
                <ClubBadge id={id} size={30} />
                <div>
                  <p className="nl-board-name">{c.name}</p>
                  <p className="nl-muted">{avg != null ? `Avg ${fmt(avg)}` : "Waiting"}</p>
                </div>
              </div>
              <ol className="nl-slots">
                {Array.from({ length: slots }, (_, i) => {
                  const p = squad[i];
                  return (
                    <li key={i} className={`nl-slot ${p ? "is-filled" : ""} ${p && p.n === newest && phase !== "after" ? "is-new" : ""}`}>
                      {p ? (
                        <>
                          <img src={photoOf(p.player)} alt="" className="nl-face is-tiny" width={22} height={22} />
                          <span className="nl-slot-name">{p.player.name}<CaptainBadge name={p.player.name} /></span>
                          <span className="nl-ovr">{fmt(p.player.rating)}</span>
                        </>
                      ) : (
                        <span className="nl-slot-empty" />
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      <div className="nl-demo">
        {mode === "demo" ? (
          <>
            <p>
              This is a practice draw, not the official one.{" "}
              <button type="button" className="nl-link" onClick={props.onLeaveDemo}>
                Back to the official draw
              </button>
            </p>
            <label className="nl-speed">
              Speed
              <select value={speed} onChange={(e) => props.onSpeed(Number(e.target.value))}>
                {[1, 3, 8].map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : !props.allowDemo ? (
          <p>The official draw is on. Share the link so everyone watches the same picks at the same time.</p>
        ) : (
          <p>Want to see how it works? Run a practice draw. It starts in 5 seconds and doesn't change anything.</p>
        )}
        <div className="nl-demo-actions">
          {props.allowDemo && (
            <button type="button" className="nl-btn" onClick={props.onStartDemo}>
              Start a demo draw
            </button>
          )}
          <button type="button" className="nl-btn is-ghost" onClick={copyLink}>
            {copied ? "Link copied" : "Copy watch link"}
          </button>
        </div>
      </div>
    </section>
  );
}

function DrawCard({ pick, beat, count, potLabel }: { pick: DrawResult["picks"][number]; beat: number; count: number; potLabel: string }) {
  const club = clubById.get(pick.club)!;
  // Joining mid-pick: skip the pull-out animation instead of replaying it.
  const [mountedLate] = useState(beat > 1);
  const style = {
    "--c1": club.colours.primary,
    "--c2": club.colours.secondary,
    "--glow": club.colours.glow,
  } as CSSProperties;
  return (
    <div className={`nl-card-wrap ${mountedLate ? "is-late" : ""} ${beat >= 5 ? "is-flying" : ""}`} style={style}>
      <div className={`nl-card ${beat >= 2 ? "is-flipped" : ""} ${beat >= 4 ? "is-revealed" : ""}`}>
        <div className="nl-card-face nl-card-back" aria-hidden="true">
          <span>N</span>
        </div>
        <div className="nl-card-face nl-card-front">
          {/* A silhouette until the reveal, then the face. */}
          <div className="nl-card-photo">
            <img src={photoOf(pick.player)} alt={beat >= 4 ? pick.player.name : ""} />
            <span className="nl-card-pos">{pick.player.position}</span>
          </div>
          <p className="nl-card-pot">{potLabel}</p>
          <p className="nl-card-ovr">{fmt(beat >= 3 ? count : COUNT_FROM)}</p>
          <div className="nl-card-who">
            {beat >= 4 ? (
              <>
                <p className="nl-card-name">{pick.player.name}<CaptainBadge name={pick.player.name} /></p>
                <p className="nl-card-club">
                  <ClubBadge id={pick.club} size={20} /> {club.name}
                </p>
              </>
            ) : (
              <p className="nl-card-name is-hidden">Who is it?</p>
            )}
          </div>
          {beat >= 4 && <span className="nl-shine" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}
