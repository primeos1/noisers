import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { ClubId } from "../lib/league";
import { ClubBadge, Shirt } from "./ClubBadge";
import { clubById, nightDate, SEASON, type LeagueData } from "./data";
import type { DrawResult, Position } from "./draw";
import { storeCredentials, storedCredentials, useGame, type Credentials } from "./game";
import { SignIn } from "./PlayPage";
import { photoOf } from "./PlayersAwards";
import {
  CHIP_LABELS,
  SCORING,
  entryFor,
  fnlCreateLeague,
  fnlJoinLeague,
  fnlLeaveLeague,
  fnlMe,
  fnlPlayers,
  fnlSaveEntry,
  fnlSaveTeam,
  gwDone,
  gwStarted,
  lineupFrom,
  scoreSeason,
  standings,
  teamGameweek,
  useFnl,
  validStart,
  type Chip,
  type FnlData,
  type FnlMine,
  type FnlPlayer,
  type Season,
  type Slot,
} from "./fnl";

type Tab = "pick" | "transfers" | "points" | "leagues" | "rules";

const TABS: [Tab, string][] = [
  ["pick", "Pick team"],
  ["transfers", "Transfers"],
  ["points", "Points"],
  ["leagues", "Leagues"],
  ["rules", "Rules"],
];

const POS_LABEL: Record<Position, string> = { GK: "Goalkeeper", DEF: "Defenders", MID: "Midfielders", FWD: "Forwards" };
const m = (n: number) => `${n.toFixed(1)}m`;
const lagos = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

interface Draft {
  gw: number;
  lineup: Slot[];
  captainId: number | null;
  viceId: number | null;
  chip: Chip | null;
}

export function FnlPage({ draw, data }: { draw: DrawResult | null; data: LeagueData | null }) {
  const live = data?.liveNight != null;
  const { fnl, error: fnlError, reload } = useFnl(live);
  const { game } = useGame(false);
  const [tab, setTab] = useState<Tab>("pick");
  const [creds, setCreds] = useState<Credentials | null>(storedCredentials);
  const [mine, setMine] = useState<FnlMine | null>(null);
  const [viewTeam, setViewTeam] = useState<number | null>(null);

  useEffect(() => {
    if (!creds || mine) return;
    fnlMe(creds).then(setMine).catch(() => {
      storeCredentials(null);
      setCreds(null);
    });
  }, [creds, mine]);

  const players = useMemo(() => (draw && fnl ? fnlPlayers(draw, fnl) : null), [draw, fnl]);
  const season = useMemo(() => (draw && data && players ? scoreSeason(draw, data, players) : null), [draw, data, players]);

  const onSaved = (next: FnlMine) => {
    setMine(next);
    void reload();
  };

  const ready = fnl && data && draw && players && season;

  return (
    <section id="fnl" className="nl-section nl-page" aria-labelledby="fnl-title">
      <p className="nl-fnl-kicker">Fantasy Noisers League</p>
      <h1 id="fnl-title" className="nl-h2">FNL</h1>
      <p className="nl-lede">
        Fantasy football for the Noisers League, FPL-style. Pick nine players on a budget, start six, captain one, and make a
        transfer a week. Every goal, assist, save and card on a league Sunday counts.
      </p>

      {fnl && <Deadline fnl={fnl} />}

      <div className="nl-tabs" role="tablist" aria-label="FNL">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {fnlError && !fnl && <p className="nl-play-error" role="alert">{fnlError}</p>}
      {!ready ? (
        <p className="nl-muted">{data && !draw ? "FNL opens once the squads are drawn." : "Loading…"}</p>
      ) : tab === "rules" ? (
        <Rules fnl={fnl} />
      ) : tab === "leagues" ? (
        <Leagues
          fnl={fnl}
          data={data}
          season={season}
          players={players}
          creds={creds}
          mine={mine}
          onSaved={onSaved}
          names={new Map((game?.players ?? []).map((p) => [p.id, p.name]))}
          onView={(id) => {
            setViewTeam(id);
            setTab("points");
          }}
        />
      ) : tab === "points" ? (
        <Points fnl={fnl} data={data} season={season} players={players} mine={mine} names={new Map((game?.players ?? []).map((p) => [p.id, p.name]))} teamId={viewTeam ?? mine?.team?.id ?? null} onTeam={setViewTeam} />
      ) : !creds || !mine ? (
        game ? (
          <SignIn
            game={game}
            busy={!!creds && !mine}
            onSignedIn={(c) => {
              storeCredentials(c);
              setCreds(c);
            }}
          />
        ) : (
          <p className="nl-muted">Loading…</p>
        )
      ) : !mine.team ? (
        <NameTeam creds={creds} onSaved={onSaved} />
      ) : fnl.openGameweek === null ? (
        <p className="nl-muted">The last gameweek has started, so squads are locked for the season. Follow it on the Points tab.</p>
      ) : (
        <Manager key={`${mine.team.id}:${fnl.openGameweek}:${mine.entries.length}`} tab={tab} fnl={fnl} mine={mine} creds={creds} players={players} season={season} data={data} onSaved={onSaved} setTab={setTab} />
      )}

      {creds && mine && (
        <p className="nl-muted nl-fnl-who">
          {mine.team ? <>Managing <strong>{mine.team.name}</strong> · </> : null}
          <button
            type="button"
            className="nl-link"
            onClick={() => {
              storeCredentials(null);
              setCreds(null);
              setMine(null);
            }}
          >
            Sign out
          </button>
        </p>
      )}
    </section>
  );
}

function Deadline({ fnl }: { fnl: FnlData }) {
  const gw = fnl.openGameweek;
  return (
    <div className="nl-fnl-deadline">
      {gw ? (
        <>
          <span>Gameweek {gw} deadline</span>
          <strong>{lagos(fnl.deadlines[gw - 1])}</strong>
        </>
      ) : (
        <span>All five gameweeks have started.</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ team name */

function NameTeam({ creds, onSaved }: { creds: Credentials; onSaved: (m: FnlMine) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(await fnlSaveTeam(creds, name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }
  return (
    <form className="nl-play-card nl-play-signin" onSubmit={submit}>
      <h2 className="nl-h3">Name your team</h2>
      <p className="nl-muted">This is what everyone sees on the league tables. You can change it later.</p>
      <label>
        <span>Team name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
      </label>
      {error && <p className="nl-play-error" role="alert">{error}</p>}
      <button type="submit" className="nl-btn" disabled={busy}>{busy ? "Saving…" : "Create team"}</button>
    </form>
  );
}

/* -------------------------------------------------------------- manager */

function Manager(props: {
  tab: Tab;
  fnl: FnlData;
  mine: FnlMine;
  creds: Credentials;
  players: Map<number, FnlPlayer>;
  season: Season;
  data: LeagueData;
  onSaved: (m: FnlMine) => void;
  setTab: (t: Tab) => void;
}) {
  const { fnl, mine, players } = props;
  const gw = fnl.openGameweek!;
  const saved = mine.entries.find((e) => e.gameweek === gw) ?? null;
  const previous = mine.entries.filter((e) => e.gameweek < gw).sort((a, b) => b.gameweek - a.gameweek)[0] ?? null;
  const base = saved ?? previous;
  // A full squad always has a captain and vice: kept if still starting, else the priciest starters.
  const armbands = (d: Draft): Draft => {
    const starters = d.lineup.slice(0, 6).map((s) => s.id);
    if (d.lineup.some((s) => s.id === null)) return d;
    const ranked = (starters as number[]).slice().sort((a, b) => (players.get(b)?.price ?? 0) - (players.get(a)?.price ?? 0));
    const captainId = d.captainId !== null && starters.includes(d.captainId) ? d.captainId : ranked[0];
    const viceId = d.viceId !== null && starters.includes(d.viceId) && d.viceId !== captainId ? d.viceId : ranked.find((id) => id !== captainId)!;
    return { ...d, captainId, viceId };
  };
  const [draft, setDraft] = useState<Draft>(() =>
    armbands({
      gw,
      lineup: lineupFrom(base, players),
      captainId: base?.captainId ?? null,
      viceId: base?.viceId ?? null,
      chip: saved?.chip ?? null,
    }),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const ids = draft.lineup.map((s) => s.id).filter((id): id is number => id !== null);
  const full = ids.length === 9;
  const spent = ids.reduce((sum, id) => sum + (players.get(id)?.price ?? 0), 0);
  // A squad that's risen in value keeps its players: the budget is whichever is bigger,
  // 58.0m or what last gameweek's squad is worth now.
  const previousEntry = mine.entries.filter((e) => e.gameweek < gw).sort((a, b) => b.gameweek - a.gameweek)[0] ?? null;
  const previousValue = previousEntry ? [...previousEntry.starters, ...previousEntry.bench].reduce((sum, id) => sum + (players.get(id)?.price ?? 0), 0) : 0;
  const allowance = Math.max(fnl.rules.budget, previousValue);
  const bank = allowance - spent;
  const perClub = new Map<ClubId, number>();
  for (const id of ids) {
    const club = players.get(id)!.club;
    perClub.set(club, (perClub.get(club) ?? 0) + 1);
  }
  const prevSquad = previous ? new Set([...previous.starters, ...previous.bench]) : null;
  const transfers = prevSquad ? ids.filter((id) => !prevSquad.has(id)).length : 0;
  const free = mine.freeTransfers;
  const hits = free === null || draft.chip === "wildcard" ? 0 : Math.max(0, transfers - free);
  const usedChips = new Set(mine.entries.filter((e) => e.gameweek !== gw && e.chip).map((e) => e.chip!));
  const startersIds = draft.lineup.slice(0, 6).map((s) => s.id);

  const problems = [
    !full && "Fill all nine places.",
    bank < -0.001 && `You're ${m(-bank)} over budget.`,
    [...perClub.values()].some((n) => n > fnl.rules.maxPerClub) && `No more than ${fnl.rules.maxPerClub} players from one club.`,
    full && !validStart(draft.lineup) && "Start your keeper and at least one defender, midfielder and forward.",
    full && (draft.captainId === null || !startersIds.includes(draft.captainId)) && "Pick a captain from your starting six.",
    full && (draft.viceId === null || !startersIds.includes(draft.viceId) || draft.viceId === draft.captainId) && "Pick a different vice-captain from your starting six.",
  ].filter(Boolean) as string[];

  const dirty =
    !saved ||
    JSON.stringify([...saved.starters, ...saved.bench]) !== JSON.stringify(draft.lineup.map((s) => s.id)) ||
    saved.captainId !== draft.captainId ||
    saved.viceId !== draft.viceId ||
    saved.chip !== draft.chip;

  async function save() {
    if (problems.length) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      props.onSaved(
        await fnlSaveEntry(props.creds, gw, {
          starters: draft.lineup.slice(0, 6).map((s) => s.id!),
          bench: draft.lineup.slice(6).map((s) => s.id!),
          captainId: draft.captainId!,
          viceId: draft.viceId!,
          chip: draft.chip,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  const update = (patch: Partial<Draft>) => {
    setNote("");
    setDraft((d) => armbands({ ...d, ...patch }));
  };

  const bar = (
    <div className="nl-fnl-bar">
      <Stat label="Bank" value={m(bank)} warn={bank < -0.001} />
      <Stat label="Free transfers" value={free === null || draft.chip === "wildcard" ? "Unlimited" : String(free)} />
      <Stat label="Transfers" value={String(transfers)} />
      <Stat label="Cost" value={hits ? `−${hits * fnl.rules.transferCost} pts` : "0 pts"} warn={hits > 0} />
    </div>
  );

  const actions = (
    <div className="nl-play-actions">
      <button type="button" className="nl-btn" disabled={busy || problems.length > 0 || !dirty} onClick={save}>
        {busy ? "Saving…" : saved ? "Save changes" : `Confirm gameweek ${gw} team`}
      </button>
      <span className="nl-muted" role="status">
        {problems[0] ?? note}
        {!problems.length && !dirty && "Saved. You can change it until the deadline."}
        {!problems.length && dirty && <strong className="nl-fnl-unsaved">Not saved yet. Confirm to lock in your team.</strong>}
      </span>
      {error && <p className="nl-play-error" role="alert">{error}</p>}
    </div>
  );

  if (props.tab === "transfers" || !full) {
    return (
      <>
        {!full && props.tab !== "transfers" && <p className="nl-muted nl-notice">First, pick your nine on the Transfers tab.</p>}
        {bar}
        <Transfers
          fnl={fnl}
          players={players}
          season={props.season}
          data={props.data}
          lineup={draft.lineup}
          bank={bank}
          perClub={perClub}
          onChange={(lineup) => update({ lineup })}
        />
        <ChipPicker chips={["wildcard"]} draft={draft} used={usedChips} disabled={!previous} onChip={(chip) => update({ chip })} />
        {full && props.tab !== "transfers" ? null : actions}
        {full && props.tab === "transfers" && (
          <p className="nl-muted">Then set your starting six, captain and bench on <button type="button" className="nl-link" onClick={() => props.setTab("pick")}>Pick team</button>.</p>
        )}
      </>
    );
  }

  return (
    <>
      <PickTeam draft={draft} players={players} onChange={update} />
      <ChipPicker chips={["bench_boost", "triple_captain"]} draft={draft} used={usedChips} disabled={false} onChip={(chip) => update({ chip })} />
      {actions}
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`nl-fnl-stat ${warn ? "is-warn" : ""}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function ChipPicker(props: { chips: Chip[]; draft: Draft; used: Set<Chip>; disabled: boolean; onChip: (c: Chip | null) => void }) {
  return (
    <div className="nl-fnl-chips">
      {props.chips.map((chip) => {
        const on = props.draft.chip === chip;
        const used = props.used.has(chip);
        const otherOn = props.draft.chip !== null && !on;
        return (
          <button
            key={chip}
            type="button"
            className={`nl-fnl-chip ${on ? "is-on" : ""}`}
            aria-pressed={on}
            disabled={used || otherOn || props.disabled}
            onClick={() => props.onChip(on ? null : chip)}
          >
            <strong>{CHIP_LABELS[chip].name}</strong>
            <small>{used ? "Used" : props.disabled ? "From gameweek 2" : otherOn ? "One chip a week" : on ? "Playing this week" : CHIP_LABELS[chip].blurb}</small>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ pick team */

function PickTeam({ draft, players, onChange }: { draft: Draft; players: Map<number, FnlPlayer>; onChange: (p: Partial<Draft>) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");

  function tap(index: number) {
    setError("");
    if (selected === null) return setSelected(index);
    if (selected === index) return setSelected(null);
    const a = Math.min(selected, index);
    const b = Math.max(selected, index);
    setSelected(null);
    // Swaps go between the six and the bench.
    if ((a < 6) === (b < 6)) return setSelected(index);
    const lineup = [...draft.lineup];
    [lineup[a], lineup[b]] = [lineup[b], lineup[a]];
    if (!validStart(lineup)) return setError("That leaves your six without a keeper, defender, midfielder or forward.");
    const starters = lineup.slice(0, 6).map((s) => s.id);
    onChange({
      lineup,
      captainId: draft.captainId !== null && starters.includes(draft.captainId) ? draft.captainId : null,
      viceId: draft.viceId !== null && starters.includes(draft.viceId) ? draft.viceId : null,
    });
  }

  const card = (slot: Slot, index: number) => {
    const p = slot.id !== null ? players.get(slot.id) : null;
    if (!p) return null;
    const starter = index < 6;
    return (
      <Kit
        key={slot.id}
        p={p}
        tag={`${clubById.get(p.club)!.short} · ${p.position}`}
        armband={draft.captainId === slot.id ? "C" : draft.viceId === slot.id ? "V" : null}
        selected={selected === index}
        onClick={() => tap(index)}
      >
        {starter && (
          <span className="nl-fnl-armbands">
            <button type="button" aria-pressed={draft.captainId === slot.id} onClick={() => onChange({ captainId: slot.id, viceId: draft.viceId === slot.id ? draft.captainId : draft.viceId })}>C</button>
            <button type="button" aria-pressed={draft.viceId === slot.id} onClick={() => onChange({ viceId: slot.id, captainId: draft.captainId === slot.id ? draft.viceId : draft.captainId })}>V</button>
          </span>
        )}
      </Kit>
    );
  };

  return (
    <>
      <p className="nl-muted nl-notice">Tap a starter, then a bench player, to swap them. C is captain (double points), V takes over if the captain doesn't play. The bench comes on in order for anyone who doesn't play.</p>
      <Pitch lineup={draft.lineup} render={card} />
      {error && <p className="nl-play-error" role="alert">{error}</p>}
    </>
  );
}

/** A player on the pitch, FPL-style: club shirt, name plate and a tag (price, club or points). */
function Kit(props: {
  p: FnlPlayer;
  tag: ReactNode;
  pts?: boolean;
  /** Captain's points tag, in gold. */
  hot?: boolean;
  armband?: "C" | "V" | "TC" | null;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <span className="nl-kit-shirt">
        <Shirt id={props.p.club} />
        <img src={photoOf(props.p.player)} alt="" className="nl-kit-face" loading="lazy" />
        {props.armband && <i className="nl-kit-badge">{props.armband}</i>}
      </span>
      <span className="nl-kit-name">{props.p.player.name}</span>
      <span className={`nl-kit-tag ${props.pts ? "is-pts" : ""} ${props.hot ? "is-hot" : ""}`}>{props.tag}</span>
    </>
  );
  return (
    <div className={`nl-kit ${props.selected ? "is-selected" : ""} ${props.dim ? "is-dim" : ""}`}>
      {props.onClick ? (
        <button type="button" className="nl-kit-main" onClick={props.onClick} aria-pressed={props.selected}>
          {inner}
        </button>
      ) : (
        <div className="nl-kit-main">{inner}</div>
      )}
      {props.children}
    </div>
  );
}

/** An open place in the squad: tap it to pick someone for that position. */
function EmptyKit({ position, active, onClick }: { position: Position; active: boolean; onClick: () => void }) {
  return (
    <div className={`nl-kit is-empty ${active ? "is-selected" : ""}`}>
      <button type="button" className="nl-kit-main" onClick={onClick} aria-label={`Add a ${POS_LABEL[position].toLowerCase()}`}>
        <span className="nl-kit-shirt"><span>+</span></span>
        <span className="nl-kit-name">Add {position}</span>
        <span className="nl-kit-tag">&nbsp;</span>
      </button>
    </div>
  );
}

/** Six on the pitch by line, three on the bench. */
function Pitch({ lineup, render }: { lineup: Slot[]; render: (slot: Slot, index: number) => ReactNode }) {
  const rows: Position[] = ["GK", "DEF", "MID", "FWD"];
  return (
    <div className="nl-fnl-pitch">
      <div className="nl-fnl-field">
        {rows.map((pos) => (
          <div key={pos} className="nl-fnl-row">
            {lineup.map((s, i) => (i < 6 && s.position === pos ? render(s, i) : null))}
          </div>
        ))}
      </div>
      <div className="nl-fnl-bench">
        <span className="nl-fnl-bench-label">Bench</span>
        <div className="nl-fnl-row">{lineup.map((s, i) => (i >= 6 ? render(s, i) : null))}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ transfers */

function Transfers(props: {
  fnl: FnlData;
  players: Map<number, FnlPlayer>;
  season: Season;
  data: LeagueData;
  lineup: Slot[];
  bank: number;
  perClub: Map<ClubId, number>;
  onChange: (l: Slot[]) => void;
}) {
  const { players, lineup } = props;
  const [filter, setFilter] = useState<Position>(() => props.lineup.find((s) => s.id === null)?.position ?? "GK");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const pickPosition = (pos: Position) => {
    setFilter(pos);
    document.getElementById("fnl-players")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const inSquad = new Set(lineup.map((s) => s.id));
  const [autoNote, setAutoNote] = useState("");
  const anyEmpty = lineup.some((s) => s.id === null);

  // Fills the empty places (or, with a full squad, all nine) with random
  // players who fit the budget and the per-club limit.
  function autoPick() {
    const keep = anyEmpty ? lineup : lineup.map((s) => ({ ...s, id: null }));
    const kept = keep.map((s) => s.id).filter((id): id is number => id !== null);
    const budget = props.fnl.rules.budget - kept.reduce((sum, id) => sum + (players.get(id)?.price ?? 0), 0);
    const pool = [...players.values()];
    for (let attempt = 0; attempt < 400; attempt++) {
      const next = keep.map((s) => ({ ...s }));
      const used = new Set(kept);
      const clubs = new Map<ClubId, number>();
      for (const id of kept) clubs.set(players.get(id)!.club, (clubs.get(players.get(id)!.club) ?? 0) + 1);
      let left = budget;
      let ok = true;
      const open = next.map((s, i) => (s.id === null ? i : -1)).filter((i) => i >= 0).sort(() => Math.random() - 0.5);
      for (let k = 0; k < open.length; k++) {
        const slot = next[open[k]];
        // Leave enough for the cheapest possible fill of the places still to come.
        const reserve = open.slice(k + 1).reduce((sum, i) => {
          const cheapest = pool.filter((p) => p.position === next[i].position && !used.has(p.player.id)).map((p) => p.price).sort((a, b) => a - b)[0];
          return sum + (cheapest ?? 0);
        }, 0);
        const options = pool.filter(
          (p) => p.position === slot.position && !used.has(p.player.id) && (clubs.get(p.club) ?? 0) < props.fnl.rules.maxPerClub && p.price <= left - reserve + 0.001,
        );
        if (!options.length) { ok = false; break; }
        const pick = options[Math.floor(Math.random() * options.length)];
        slot.id = pick.player.id;
        used.add(pick.player.id);
        clubs.set(pick.club, (clubs.get(pick.club) ?? 0) + 1);
        left -= pick.price;
      }
      if (ok) {
        props.onChange(next);
        setChosen(null);
        setAutoNote(`Picked at random, ${m(left)} left in the bank. Tap again to re-roll, then confirm.`);
        return;
      }
    }
    setAutoNote("Couldn't fit a random squad around your current picks. Take someone out and try again.");
  }
  const total = (id: number) => SEASON.reduce((sum, n) => sum + (props.season(n.number, id)?.points ?? 0), 0);

  const remove = (index: number) => props.onChange(lineup.map((s, i) => (i === index ? { ...s, id: null } : s)));
  const add = (id: number) => {
    const p = players.get(id)!;
    const index = lineup.findIndex((s) => s.id === null && s.position === p.position);
    if (index < 0) return;
    props.onChange(lineup.map((s, i) => (i === index ? { ...s, id } : s)));
  };

  const list = [...players.values()]
    .filter((p) => p.position === filter && p.player.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.price - a.price || a.player.name.localeCompare(b.player.name));
  const openSlot = lineup.some((s) => s.id === null && s.position === filter);

  return (
    <div className="nl-fnl-transfers">
      <div>
        <div className="nl-fnl-autopick">
          <p className="nl-muted">Tap a player to take them out, then an empty shirt to choose who comes in.</p>
          <button type="button" className="nl-btn is-ghost" onClick={autoPick}>{anyEmpty ? "Auto-pick" : "Random squad"}</button>
        </div>
        {autoNote && <p className="nl-muted nl-notice" role="status">{autoNote}</p>}
        <div className="nl-fnl-pitch">
          <div className="nl-fnl-field">
            {(["GK", "DEF", "MID", "FWD"] as Position[]).map((pos) => (
              <div key={pos} className="nl-fnl-row">
                {lineup.map((s, i) => {
                  if (s.position !== pos) return null;
                  if (s.id === null) return <EmptyKit key={`e${i}`} position={pos} active={filter === pos} onClick={() => pickPosition(pos)} />;
                  const fp = players.get(s.id)!;
                  return (
                    <Kit key={s.id} p={fp} tag={m(fp.price)} selected={chosen === i} onClick={() => setChosen(chosen === i ? null : i)}>
                      {chosen === i && (
                        <button type="button" className="nl-kit-out" onClick={() => { remove(i); setChosen(null); pickPosition(pos); }}>
                          Transfer out
                        </button>
                      )}
                    </Kit>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="nl-play-card" id="fnl-players">
        <h2 className="nl-h3">Players</h2>
        <div className="nl-fnl-filters">
          {(["GK", "DEF", "MID", "FWD"] as Position[]).map((pos) => (
            <button key={pos} type="button" aria-pressed={filter === pos} className={filter === pos ? "is-on" : ""} onClick={() => setFilter(pos)}>{pos}</button>
          ))}
          <input type="search" placeholder="Search" aria-label="Search players" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ul className="nl-fnl-list">
          {list.map((p) => {
            const owned = inSquad.has(p.player.id);
            const tooDear = p.price > props.bank + 0.001;
            const clubFull = (props.perClub.get(p.club) ?? 0) >= props.fnl.rules.maxPerClub;
            const why = owned ? "In squad" : !openSlot ? `${filter} full` : tooDear ? "Too dear" : clubFull ? "Club full" : null;
            return (
              <li key={p.player.id}>
                <span className="nl-fnl-listface">
                  <img src={photoOf(p.player)} alt="" loading="lazy" />
                  <ClubBadge id={p.club} size={18} />
                </span>
                <span className="nl-fnl-list-name">
                  <strong>{p.player.name}</strong>
                  <small>{clubById.get(p.club)!.short} · {total(p.player.id)} pts{p.owned ? ` · ${p.owned}% picked` : ""}</small>
                </span>
                <span className="nl-fnl-price">
                  {m(p.price)}
                  {p.change !== 0 && <small className={p.change > 0 ? "is-up" : "is-down"}>{p.change > 0 ? "▲" : "▼"}{Math.abs(p.change).toFixed(1)}</small>}
                </span>
                <button type="button" className="nl-btn is-ghost nl-fnl-add" disabled={!!why} onClick={() => add(p.player.id)}>
                  {why ?? "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- points */

/** Your saved squad for the gameweek coming up: only you can see it until the deadline. */
function MyUpcoming({ fnl, mine, players }: { fnl: FnlData; mine: FnlMine | null; players: Map<number, FnlPlayer> }) {
  const gw = fnl.openGameweek;
  if (!gw || !mine?.team) return null;
  const entry = entryFor(mine.entries, mine.team.id, gw);
  if (!entry) return <p className="nl-muted nl-notice">You haven't picked a squad for gameweek {gw} yet. Head to Transfers.</p>;
  const lineup = [...entry.starters, ...entry.bench].map((id) => ({ id, position: players.get(id)?.position ?? ("MID" as Position) }));
  const spent = lineup.reduce((sum, s) => sum + (players.get(s.id)?.price ?? 0), 0);
  const card = (slot: Slot) => {
    const p = slot.id !== null ? players.get(slot.id) : null;
    if (!p) return null;
    return <Kit key={slot.id} p={p} tag={m(p.price)} armband={p.player.id === entry.captainId ? "C" : p.player.id === entry.viceId ? "V" : null} />;
  };
  return (
    <>
      <h2 className="nl-h3">{mine.team.name}: gameweek {gw}</h2>
      <p className="nl-muted nl-notice">
        Saved squad, {m(spent)} spent{entry.chip ? `, ${CHIP_LABELS[entry.chip].name} on` : ""}. Only you can see it until the deadline; points start at kick-off.
      </p>
      <Pitch lineup={lineup} render={card} />
    </>
  );
}

function Points(props: { fnl: FnlData; data: LeagueData; season: Season; players: Map<number, FnlPlayer>; mine: FnlMine | null; names: Map<number, string>; teamId: number | null; onTeam: (id: number) => void }) {
  const { fnl, data, season, players } = props;
  const started = SEASON.map((n) => n.number).filter((gw) => gwStarted(gw, data));
  const [gwPick, setGwPick] = useState<number | null>(null);
  const gw = gwPick ?? started[started.length - 1] ?? null;
  const teamId = props.teamId ?? fnl.teams[0]?.id ?? null;

  if (!gw) {
    // Before kick-off: your own squad; anyone else's stays hidden until the deadline.
    const mineId = props.mine?.team?.id ?? null;
    const other = props.teamId !== null && props.teamId !== mineId ? fnl.teams.find((t) => t.id === props.teamId) : null;
    const deadline = fnl.openGameweek ? new Date(fnl.deadlines[fnl.openGameweek - 1]).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }) : "";
    return (
      <>
        {fnl.teams.length > 0 && (
          <label className="nl-fnl-teampick">
            <span className="nl-muted">Team</span>
            <select value={other?.id ?? mineId ?? ""} onChange={(e) => props.onTeam(Number(e.target.value))}>
              {mineId === null && <option value="">Pick a team</option>}
              {fnl.teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.id === mineId ? " (you)" : ""}</option>
              ))}
            </select>
          </label>
        )}
        {other ? (
          <div className="nl-play-card">
            <h2 className="nl-h3">{other.name}</h2>
            <p className="nl-muted">Their squad is revealed at the gameweek {fnl.openGameweek} deadline ({deadline}), so nobody can copy it. Check back at kick-off.</p>
          </div>
        ) : props.mine?.team ? (
          <MyUpcoming fnl={fnl} mine={props.mine} players={players} />
        ) : (
          <p className="nl-muted nl-notice">Sign in on Pick team to see your own squad here.</p>
        )}
        <p className="nl-muted">Points start when gameweek 1 kicks off on {nightDate(1)}. Everyone's squads show at the deadline.</p>
      </>
    );
  }
  if (!teamId) return <p className="nl-muted">No teams yet.</p>;

  const result = teamGameweek(fnl.entries, teamId, gw, data, season, players);
  const all = fnl.teams.map((t) => teamGameweek(fnl.entries, t.id, gw, data, season, players)?.points).filter((x): x is number => x !== undefined);
  const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
  const best = all.length ? Math.max(...all) : 0;
  const team = fnl.teams.find((t) => t.id === teamId) ?? null;
  const rank = result ? all.filter((x) => x > result.points).length + 1 : null;
  const chips: { text: string; tone: string }[] = result
    ? [
        ...(result.entry.gameweek === gw && result.entry.chip ? [{ text: `${CHIP_LABELS[result.entry.chip].name} played`, tone: "is-gold" }] : []),
        ...(result.entry.gameweek === gw && result.entry.transferCost ? [{ text: `−${result.entry.transferCost} pts transfers`, tone: "is-red" }] : []),
        ...result.subs.map((s) => ({ text: `Auto-sub: ${players.get(s.in)?.player.name} on for ${players.get(s.out)?.player.name}`, tone: "" })),
        ...(result.captainId !== null && result.captainId !== result.entry.captainId ? [{ text: "Captain didn't play: vice took the armband", tone: "" }] : []),
      ]
    : [];

  const card = (slot: Slot, index: number) => {
    const p = slot.id !== null ? players.get(slot.id) : null;
    if (!p || !result) return null;
    const line = season(gw, p.player.id);
    const mult = p.player.id === result.captainId ? result.multiplier : 1;
    const counts = index < 6 || result.entry.chip === "bench_boost";
    return (
      <Kit
        key={slot.id}
        p={p}
        pts
        hot={mult > 1 && !!line?.games}
        dim={!line?.games || !counts}
        tag={line?.games ? (line.points * mult) : gwDone(gw, data) ? "DNP" : "–"}
        armband={p.player.id === result.captainId ? (mult === 3 ? "TC" : "C") : p.player.id === result.entry.viceId ? "V" : null}
      />
    );
  };

  return (
    <>
      <div className="nl-tabs" role="tablist" aria-label="Gameweek">
        {started.map((n) => (
          <button key={n} type="button" role="tab" aria-selected={gw === n} className={gw === n ? "is-active" : ""} onClick={() => setGwPick(n)}>
            <span>GW {n}</span>
            <small>{nightDate(n)}</small>
            {data.liveNight === n && <i className="nl-dot" aria-label="Live" />}
          </button>
        ))}
      </div>
      <label className="nl-fnl-teampick">
        <span className="nl-muted">Team</span>
        <select value={teamId} onChange={(e) => props.onTeam(Number(e.target.value))}>
          {fnl.teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      {!result ? (
        <p className="nl-muted">This team hadn't picked a squad by gameweek {gw}.</p>
      ) : (
        <>
          <div className="nl-fnl-hero">
            <div className="nl-fnl-hero-team">
              <small>Gameweek {gw}{data.liveNight === gw ? " · live" : gwDone(gw, data) ? " · final" : ""}</small>
              <strong>{team?.name}</strong>
              <span>{team ? props.names.get(team.playerId) ?? "" : ""}</span>
            </div>
            <div className="nl-fnl-hero-pts">
              <strong>{result.points}</strong>
              <small>Points</small>
            </div>
            <div className="nl-fnl-hero-side">
              <div><strong>{avg}</strong><small>Average</small></div>
              <div><strong>{best}</strong><small>Highest</small></div>
              <div><strong>{rank ? `${rank}/${all.length}` : "–"}</strong><small>GW rank</small></div>
            </div>
          </div>
          {chips.length > 0 && (
            <ul className="nl-fnl-flags">
              {chips.map((c) => (
                <li key={c.text} className={c.tone}>{c.text}</li>
              ))}
            </ul>
          )}
          <Pitch lineup={[...result.starters, ...result.bench].map((id) => ({ id, position: players.get(id)?.position ?? "MID" }))} render={card} />
          <div className="nl-table-wrap nl-fnl-breakdown">
            <table className="nl-table">
              <thead>
                <tr>
                  <th scope="col" className="is-club">Player</th>
                  <th scope="col" title="Games played">GP</th>
                  <th scope="col" title="Goals">G</th>
                  <th scope="col" title="Assists">A</th>
                  <th scope="col" title="Clean sheets" className="is-wide">CS</th>
                  <th scope="col" title="Saves" className="is-wide">Sv</th>
                  <th scope="col" title="Bonus">B</th>
                  <th scope="col">Pts</th>
                </tr>
              </thead>
              <tbody>
                {[...result.starters, ...result.bench].map((id, i) => {
                  const p = players.get(id);
                  if (!p) return null;
                  const l = season(gw, id);
                  const mult = id === result.captainId ? result.multiplier : 1;
                  const counts = i < 6 || result.entry.chip === "bench_boost";
                  return (
                    <tr key={id} className={counts ? "" : "is-bench"}>
                      <th scope="row" className="is-club">
                        <ClubBadge id={p.club} size={22} />
                        <span>{p.player.name}{id === result.captainId ? (mult === 3 ? " (TC)" : " (C)") : id === result.entry.viceId ? " (V)" : ""}</span>
                      </th>
                      <td>{l?.games ?? 0}</td>
                      <td>{l?.goals ?? 0}</td>
                      <td>{l?.assists ?? 0}</td>
                      <td className="is-wide">{l?.cleanSheets ?? 0}</td>
                      <td className="is-wide">{l?.saves ?? 0}</td>
                      <td>{l?.bonus ?? 0}</td>
                      <td className="is-pts">{counts ? (l?.points ?? 0) * mult : <span className="nl-muted">{l?.points ?? 0}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="nl-muted nl-note">Bench points only count with Bench Boost. Captain doubles (Triple Captain triples).</p>
          </div>
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------- leagues */

function Leagues(props: {
  fnl: FnlData;
  data: LeagueData;
  season: Season;
  players: Map<number, FnlPlayer>;
  creds: Credentials | null;
  mine: FnlMine | null;
  onSaved: (m: FnlMine) => void;
  names: Map<number, string>;
  onView: (teamId: number) => void;
}) {
  const { fnl, data, season, players, mine } = props;
  const [shown, setShown] = useState<number | 0>(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const myLeagues = mine?.leagues ?? [];
  const league = shown ? fnl.leagues.find((l) => l.id === shown) ?? myLeagues.find((l) => l.id === shown) : null;
  const teams = league ? fnl.teams.filter((t) => league.teamIds.includes(t.id)) : fnl.teams;
  const table = standings(teams, fnl, data, season, players, SEASON.length);
  const managerName = (playerId: number) => props.names.get(playerId);

  async function run(fn: () => Promise<FnlMine>) {
    setBusy(true);
    setError("");
    try {
      props.onSaved(await fn());
      setName("");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nl-tabs" role="tablist" aria-label="Leagues">
        <button type="button" role="tab" aria-selected={shown === 0} className={shown === 0 ? "is-active" : ""} onClick={() => setShown(0)}>
          <span>Overall</span>
          <small>{fnl.teams.length} teams</small>
        </button>
        {myLeagues.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={shown === l.id} className={shown === l.id ? "is-active" : ""} onClick={() => setShown(l.id)}>
            <span>{l.name}</span>
            <small>{l.teamIds.length} teams</small>
          </button>
        ))}
      </div>

      {league?.code && (
        <p className="nl-muted nl-notice">
          Invite code <strong className="nl-fnl-code">{league.code}</strong>. Share it, and others join from this tab.{" "}
          {props.creds && (
            <button type="button" className="nl-link" disabled={busy} onClick={() => run(() => fnlLeaveLeague(props.creds!, league.id))}>
              Leave league
            </button>
          )}
        </p>
      )}

      <div className="nl-table-wrap">
        {table.length === 0 ? (
          <p className="nl-muted nl-note">No teams yet. Be the first.</p>
        ) : (
          <table className="nl-table">
            <thead>
              <tr>
                <th scope="col" className="is-pos">Rank</th>
                <th scope="col" className="is-club">Team</th>
                <th scope="col">GW</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.team.id} className={row.team.id === mine?.team?.id ? "is-mine" : ""}>
                  <td className="is-pos">{i + 1}</td>
                  <th scope="row" className="is-club">
                    <button type="button" className="nl-fnl-teamlink" onClick={() => props.onView(row.team.id)}>
                      <strong>{row.team.name}</strong>
                      <small>{managerName(row.team.playerId) ?? ""}</small>
                    </button>
                  </th>
                  <td>{row.gw}</td>
                  <td className="is-pts">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {props.creds && mine?.team ? (
        <div className="nl-fnl-leagueforms">
          <form
            className="nl-play-card"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => fnlCreateLeague(props.creds!, name));
            }}
          >
            <h2 className="nl-h3">Start a league</h2>
            <label>
              <span>League name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
            </label>
            <button type="submit" className="nl-btn" disabled={busy}>Create</button>
          </form>
          <form
            className="nl-play-card"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => fnlJoinLeague(props.creds!, code));
            }}
          >
            <h2 className="nl-h3">Join a league</h2>
            <label>
              <span>Invite code</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} required />
            </label>
            <button type="submit" className="nl-btn" disabled={busy}>Join</button>
          </form>
        </div>
      ) : (
        <p className="nl-muted">Sign in and create a team on Pick team to start or join a private league.</p>
      )}
      {error && <p className="nl-play-error" role="alert">{error}</p>}
    </>
  );
}

/* ---------------------------------------------------------------- rules */

function Rules({ fnl }: { fnl: FnlData }) {
  const r = fnl.rules;
  return (
    <div className="nl-fnl-rules">
      <div className="nl-play-card">
        <h2 className="nl-h3">Your squad</h2>
        <ul>
          <li>Nine players: 1 goalkeeper, 3 defenders, 2 midfielders and 3 forwards, from any of the six clubs.</li>
          <li>A {m(r.budget)} budget. Prices start from each player's league rating.</li>
          <li>Prices move at every deadline: a player picked by more managers than average goes up 0.1m for every extra 10% of managers, and one picked by fewer (or dropped) goes down, by up to 1.0m either way.</li>
          <li>If your squad rises in value you can keep it, even over budget. Transfers just can't take you further over.</li>
          <li>No more than {r.maxPerClub} players from one club.</li>
          <li>Six start: your keeper plus five outfielders, with at least one defender, midfielder and forward. Three sit on the bench, in order.</li>
          <li>Your captain scores double. If they don't play, your vice-captain does.</li>
          <li>If a starter doesn't play all Sunday, your bench comes on in order, as long as the six still has a keeper and one of each line.</li>
        </ul>
      </div>
      <div className="nl-play-card">
        <h2 className="nl-h3">Gameweeks and transfers</h2>
        <ul>
          <li>Each league Sunday is a gameweek. The deadline is 9pm, when the first game kicks off. Squads lock then and everyone's team can be seen.</li>
          <li>Change your squad as much as you like before your first deadline.</li>
          <li>After that you get one free transfer a week. An unused one rolls over, up to two.</li>
          <li>Every extra transfer costs {r.transferCost} points.</li>
          <li>Changing who starts, the bench order and the captain is always free.</li>
        </ul>
      </div>
      <div className="nl-play-card">
        <h2 className="nl-h3">Chips</h2>
        <p className="nl-muted">One of each for the season, one chip a week.</p>
        <dl className="nl-fnl-dl">
          {r.chips.map((c) => (
            <div key={c}><dt>{CHIP_LABELS[c].name}</dt><dd>{CHIP_LABELS[c].blurb}</dd></div>
          ))}
        </dl>
      </div>
      <div className="nl-play-card">
        <h2 className="nl-h3">Points</h2>
        <p className="nl-muted">Per game. Clubs play three games a Sunday, and a player scores in every game they're on the pitch for.</p>
        <dl className="nl-fnl-dl">
          {SCORING.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      </div>
    </div>
  );
}
