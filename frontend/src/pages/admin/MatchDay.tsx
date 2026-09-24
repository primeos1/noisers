import { useState } from "react";
import { useSquad } from "../../lib/SquadContext";
import { useCards } from "../../lib/CardsContext";
import { useValeContent } from "../../lib/ValeContentContext";
import { nextJerseyNumber, type Player } from "../../lib/clubData";
import { useMatchDay } from "../../lib/MatchDayContext";
import { useSettings } from "../../lib/SettingsContext";
import PlayerFormModal from "../../components/admin/PlayerFormModal";
import {
  buildTeams,
  defaultTeamName,
  nextGuestId,
  participantName,
  scoreOf,
  isoDateLabel,
  todayLabel,
  uniqueEventId,
  type MatchDayEvent,
  type MatchDayGame,
  type MatchDayGoal,
  type MatchDayTeam,
  type ParticipantId,
  type TeamMode,
} from "../../lib/matchDay";
import { formatClock, useMatchTimer } from "../../lib/useMatchTimer";

const inputClass =
  "mt-1 w-full border border-ink-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-paper";
const labelClass = "block text-sm text-paper-dim";

const modeOptions: { value: TeamMode; label: string; hint: string }[] = [
  { value: "random", label: "Fully random", hint: "No balancing — just a shuffle." },
  { value: "rating", label: "By rating", hint: "Spreads strong and weak ratings evenly." },
  { value: "position", label: "By position", hint: "Spreads GK/DEF/MID/FWD evenly." },
];

function parseParticipant(v: string): ParticipantId {
  return /^\d+$/.test(v) ? Number(v) : v;
}

export default function MatchDay() {
  const { players, addPlayer, refresh: refreshSquad } = useSquad();
  const { refresh: refreshCards } = useCards();
  const { refresh: refreshVale } = useValeContent();
  const { events, addEvent, updateEvent, error: matchDayError } = useMatchDay();
  const { settings } = useSettings();
  const TEAM_SIZE = settings.matchTeamSize;
  const WIN_GOALS = settings.matchWinGoals;

  const [activeEventId, setActiveEventId] = useState<string | null>(
    () => events.find((e) => e.status === "live")?.id ?? null,
  );
  const activeEvent = events.find((e) => e.id === activeEventId) ?? null;

  const [titleDraft, setTitleDraft] = useState("");
  const [venueDraft, setVenueDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [createError, setCreateError] = useState("");

  const [mode, setMode] = useState<TeamMode>("random");
  const [playA, setPlayA] = useState(0);
  const [playB, setPlayB] = useState(1);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [goalTeam, setGoalTeam] = useState<0 | 1>(0);
  const [goalPlayer, setGoalPlayer] = useState<ParticipantId | "">("");
  const [assistPlayer, setAssistPlayer] = useState<ParticipantId | "">("");
  const [ownGoal, setOwnGoal] = useState(false);
  const [cardTeam, setCardTeam] = useState<0 | 1>(0);
  const [cardPlayer, setCardPlayer] = useState<ParticipantId | "">("");
  const [cardType, setCardType] = useState<"yellow" | "red">("yellow");
  const [cardReason, setCardReason] = useState("");
  const [subTeam, setSubTeam] = useState<0 | 1>(0);
  const [subOff, setSubOff] = useState<ParticipantId | "">("");
  const [subOn, setSubOn] = useState<ParticipantId | "">("");

  const resumable = events.filter((e) => e.status === "live" && e.id !== activeEventId);
  const liveGame = activeEvent?.games.find((g) => g.status === "live") ?? null;
  const pastGames = activeEvent ? activeEvent.games.filter((g) => g.id !== liveGame?.id) : [];
  const timer = useMatchTimer(liveGame, (clock) => updateLiveGame((g) => ({ ...g, ...clock })));

  function name(id: ParticipantId) {
    return activeEvent ? participantName(players, activeEvent.guests, id) : String(id);
  }

  function handleCreate() {
    if (!titleDraft.trim() || !venueDraft.trim() || !dateDraft.trim()) {
      setCreateError("Enter a title, venue and date.");
      return;
    }
    const id = uniqueEventId(titleDraft, events);
    const event: MatchDayEvent = {
      id,
      title: titleDraft.trim(),
      venue: venueDraft.trim(),
      date: isoDateLabel(dateDraft),
      createdAt: todayLabel(),
      presentPlayers: [],
      guests: [],
      groups: [],
      games: [],
      status: "live",
    };
    addEvent(event);
    setActiveEventId(id);
    setTitleDraft("");
    setVenueDraft("");
    setDateDraft("");
    setCreateError("");
  }

  function patch(p: Partial<MatchDayEvent>) {
    if (!activeEvent) return Promise.resolve(false);
    return updateEvent(activeEvent.id, p);
  }

  function togglePresent(number: number) {
    if (!activeEvent) return;
    const has = activeEvent.presentPlayers.includes(number);
    patch({
      presentPlayers: has
        ? activeEvent.presentPlayers.filter((n) => n !== number)
        : [...activeEvent.presentPlayers, number],
    });
  }

  function handleAddPlayer(player: Player) {
    addPlayer(player);
    if (activeEvent) patch({ presentPlayers: [...activeEvent.presentPlayers, player.number] });
    setAddingPlayer(false);
  }

  function addGuest() {
    if (!activeEvent) return;
    const id = nextGuestId(activeEvent.guests);
    patch({ guests: [...activeEvent.guests, { id, name: `Guest ${activeEvent.guests.length + 1}` }] });
  }

  function renameGuest(id: string, newName: string) {
    if (!activeEvent) return;
    patch({ guests: activeEvent.guests.map((g) => (g.id === id ? { ...g, name: newName } : g)) });
  }

  function removeGuest(id: string) {
    if (!activeEvent) return;
    patch({
      guests: activeEvent.guests.filter((g) => g.id !== id),
      groups: activeEvent.groups.map((t) => ({ ...t, players: t.players.filter((p) => p !== id) })),
    });
  }

  function handleRandomize() {
    if (!activeEvent) return;
    const groups = buildTeams(players, activeEvent.presentPlayers, activeEvent.guests, mode, TEAM_SIZE);
    patch({ groups });
    setPlayA(0);
    setPlayB(groups.length > 1 ? 1 : 0);
  }

  function addNewTeam() {
    if (!activeEvent) return;
    patch({ groups: [...activeEvent.groups, { name: defaultTeamName(activeEvent.groups.length), players: [] }] });
  }

  function renameTeam(index: number, newName: string) {
    if (!activeEvent) return;
    patch({ groups: activeEvent.groups.map((t, i) => (i === index ? { ...t, name: newName } : t)) });
  }

  function assignToTeam(index: number, id: ParticipantId) {
    if (!activeEvent) return;
    const target = activeEvent.groups[index];
    if (!target || target.players.length >= TEAM_SIZE) return;
    patch({
      groups: activeEvent.groups.map((t, i) => {
        const players = t.players.filter((p) => p !== id);
        return i === index ? { ...t, players: [...players, id] } : { ...t, players };
      }),
    });
  }

  function removeFromTeam(index: number, id: ParticipantId) {
    if (!activeEvent) return;
    patch({
      groups: activeEvent.groups.map((t, i) => (i === index ? { ...t, players: t.players.filter((p) => p !== id) } : t)),
    });
  }

  function startGame() {
    if (!activeEvent || activeEvent.groups.length < 2 || playA === playB) return;
    const teamA = activeEvent.groups[playA];
    const teamB = activeEvent.groups[playB];
    if (!teamA || !teamB) return;
    const game: MatchDayGame = {
      id: `g${Date.now()}`,
      teams: [
        { name: teamA.name, players: [...teamA.players] },
        { name: teamB.name, players: [...teamB.players] },
      ],
      goals: [],
      cards: [],
      status: "live",
      clockStartedAt: null,
      clockElapsed: 0,
    };
    patch({ games: [...activeEvent.games, game] });
  }

  function updateLiveGame(updater: (game: MatchDayGame) => MatchDayGame) {
    if (!activeEvent || !liveGame) return Promise.resolve(false);
    return patch({ games: activeEvent.games.map((g) => (g.id === liveGame.id ? updater(g) : g)) });
  }

  // Squad stats only count finished games, so reload them once one is saved.
  function finishLiveGame(updater: (game: MatchDayGame) => MatchDayGame) {
    updateLiveGame((g) => ({ ...updater(g), ...timer.stoppedClock(), status: "finished" })).then((saved) => {
      if (saved) refreshSquad();
    });
  }

  function addGoal() {
    if (!liveGame || goalPlayer === "") return;
    const goal: MatchDayGoal = {
      id: `g${Date.now()}`,
      teamIndex: goalTeam,
      playerId: goalPlayer,
      assistPlayerId: !ownGoal && assistPlayer !== "" ? assistPlayer : undefined,
      ownGoal,
      minute: timer.minute,
    };
    const goals = [...liveGame.goals, goal];
    const finishNow = scoreOf({ goals }, 0) >= WIN_GOALS || scoreOf({ goals }, 1) >= WIN_GOALS;
    if (finishNow) finishLiveGame((g) => ({ ...g, goals }));
    else updateLiveGame((g) => ({ ...g, goals }));
    setGoalPlayer("");
    setAssistPlayer("");
    setOwnGoal(false);
  }

  function removeGoal(id: string) {
    updateLiveGame((g) => ({ ...g, goals: g.goals.filter((goal) => goal.id !== id) }));
  }

  function addCard() {
    if (!liveGame || cardPlayer === "") return;
    updateLiveGame((g) => ({
      ...g,
      cards: [
        ...g.cards,
        {
          id: `c${Date.now()}`,
          teamIndex: cardTeam,
          playerId: cardPlayer,
          type: cardType,
          reason: cardReason.trim() || (cardType === "yellow" ? "Yellow card" : "Red card"),
          minute: timer.minute,
        },
      ],
    }));
    setCardPlayer("");
    setCardReason("");
  }

  function removeCard(id: string) {
    updateLiveGame((g) => ({ ...g, cards: g.cards.filter((c) => c.id !== id) }));
  }

  function substitute() {
    if (!liveGame || subOff === "" || subOn === "") return;
    updateLiveGame((g) => {
      const teams = [...g.teams] as [MatchDayTeam, MatchDayTeam];
      const roster = teams[subTeam].players.filter((id) => id !== subOff);
      roster.push(subOn);
      teams[subTeam] = { ...teams[subTeam], players: roster };
      return { ...g, teams };
    });
    setSubOff("");
    setSubOn("");
  }

  function endGame() {
    finishLiveGame((g) => g);
  }

  function endMatchDay() {
    if (!activeEvent) return;
    updateEvent(activeEvent.id, {
      games: activeEvent.games.map((g) =>
        g.status === "live" ? { ...g, ...timer.stoppedClock(), status: "finished" } : g,
      ),
      status: "ended",
    }).then((saved) => {
      // Ending the day files the cards (with fines) and rewrites The Vale's
      // weekly awards server-side — reload everything that shows them.
      if (saved) Promise.all([refreshSquad(), refreshCards(), refreshVale()]);
    });
    setConfirmEnd(false);
  }

  function startNewMatchDay() {
    setActiveEventId(null);
  }

  const allPresentIds: ParticipantId[] = activeEvent
    ? [...activeEvent.presentPlayers, ...activeEvent.guests.map((g) => g.id)]
    : [];
  const assignedIds = new Set<ParticipantId>(activeEvent ? activeEvent.groups.flatMap((t) => t.players) : []);
  const unassigned = allPresentIds.filter((id) => !assignedIds.has(id));
  const benchIds = liveGame
    ? allPresentIds.filter((id) => !liveGame.teams[0].players.includes(id) && !liveGame.teams[1].players.includes(id))
    : [];

  return (
    <div>
      <p className="text-sm text-paper-dim">Internal squad sessions</p>
      <h1 className="mt-3 font-display text-4xl text-paper md:text-5xl">
        Match Day
      </h1>
      {matchDayError && (
        <p className="mt-4 border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
          {matchDayError} — check your connection and try the action again.
        </p>
      )}

      {!activeEvent && (
        <div className="mt-10 max-w-lg space-y-8">
          {resumable.length > 0 && (
            <div className="border border-ink-line bg-ink-raised p-5">
              <p className="text-sm text-paper-dim">Resume an in-progress match day:</p>
              <ul className="mt-3 space-y-2">
                {resumable.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setActiveEventId(e.id)}
                      className="text-paper underline underline-offset-4 hover:text-paper-dim"
                    >
                      {e.title} — {e.venue}, {e.date}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="font-display text-2xl text-paper">Create match day</h2>
            <p className="mt-2 text-sm text-paper-dim">
              Give this session a title, venue and date — the title becomes
              its id. Save it, then you can pick who's playing.
            </p>
            <div className="mt-4 space-y-4">
              <label className={labelClass}>
                Title
                <input
                  type="text"
                  className={inputClass}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="e.g. Sunday Session #12"
                />
              </label>
              <label className={labelClass}>
                Venue
                <input
                  type="text"
                  className={inputClass}
                  value={venueDraft}
                  onChange={(e) => setVenueDraft(e.target.value)}
                  placeholder="e.g. Zenith Astro, Pitch 2"
                />
              </label>
              <label className={labelClass}>
                Date
                <input
                  type="date"
                  className={`${inputClass} [color-scheme:dark]`}
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                />
              </label>
              {createError && <p className="text-sm text-loss">{createError}</p>}
              <button
                type="button"
                onClick={handleCreate}
                className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
              >
                Save & continue
              </button>
            </div>
          </div>
        </div>
      )}

      {activeEvent && (
        <div className="mt-6 flex flex-col gap-4 border-b border-ink-line pb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-2xl text-paper">{activeEvent.title}</p>
            <p className="text-sm text-paper-dim">
              {activeEvent.venue} · {activeEvent.date}
              {activeEvent.status === "ended" && " · Ended"}
            </p>
          </div>
          {activeEvent.status === "live" && (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="border border-loss bg-loss px-5 py-2.5 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
            >
              End match day
            </button>
          )}
        </div>
      )}

      {activeEvent && activeEvent.status === "ended" && (
        <div className="mt-8 space-y-6">
          <p className="text-sm text-paper-dim">
            This match day has ended and is now view-only. Full detail is in{" "}
            <span className="text-paper">Matches</span>.
          </p>
          <div className="space-y-3">
            {activeEvent.games.length === 0 ? (
              <p className="text-sm text-mist">No games were played.</p>
            ) : (
              activeEvent.games.map((g) => (
                <div key={g.id} className="border border-ink-line bg-ink-raised p-4 text-sm">
                  {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
                </div>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={startNewMatchDay}
            className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper"
          >
            Start new match day
          </button>
        </div>
      )}

      {activeEvent && activeEvent.status === "live" && !liveGame && (
        <div className="mt-8 space-y-10">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-paper">Who's present?</h2>
              <button
                type="button"
                onClick={() => setAddingPlayer(true)}
                className="border border-ink-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
              >
                + Add new player
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-mist">{activeEvent.presentPlayers.length} squad selected</p>
              <div className="flex gap-3 text-sm text-paper-dim">
                <button type="button" onClick={() => patch({ presentPlayers: players.map((p) => p.number) })} className="hover:text-paper">
                  Select all
                </button>
                <button type="button" onClick={() => patch({ presentPlayers: [] })} className="hover:text-paper">
                  Select none
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-px bg-ink-line sm:grid-cols-2 lg:grid-cols-3">
              {[...players]
                .sort((a, b) => a.number - b.number)
                .map((player) => (
                  <label
                    key={player.number}
                    className="flex cursor-pointer items-center gap-3 bg-ink px-4 py-3 text-sm text-paper-dim hover:text-paper"
                  >
                    <input
                      type="checkbox"
                      checked={activeEvent.presentPlayers.includes(player.number)}
                      onChange={() => togglePresent(player.number)}
                      className="h-4 w-4 accent-paper"
                    />
                    <span className="text-mist">#{player.number}</span>
                    <span>{player.name}</span>
                  </label>
                ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-paper">Guests</h2>
              <button
                type="button"
                onClick={addGuest}
                className="border border-ink-line px-3 py-1.5 text-sm text-paper-dim hover:text-paper"
              >
                + Add guest
              </button>
            </div>
            {activeEvent.guests.length === 0 ? (
              <p className="mt-3 text-sm text-mist">No guests added — anyone outside the squad plays under a guest id.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activeEvent.guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-3">
                    <span className="text-xs text-mist">{g.id}</span>
                    <input
                      type="text"
                      className={`${inputClass} mt-0 max-w-xs`}
                      value={g.name}
                      onChange={(e) => renameGuest(g.id, e.target.value)}
                    />
                    <button type="button" onClick={() => removeGuest(g.id)} className="text-sm text-mist hover:text-loss">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-display text-2xl text-paper">Randomize teams</h2>
            <div className="mt-4 grid gap-px bg-ink-line sm:grid-cols-3">
              {modeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={`bg-ink p-4 text-left ${mode === opt.value ? "ring-2 ring-inset ring-paper" : ""}`}
                >
                  <p className={mode === opt.value ? "text-paper" : "text-paper-dim"}>{opt.label}</p>
                  <p className="mt-1 text-xs text-mist">{opt.hint}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRandomize}
                disabled={activeEvent.presentPlayers.length + activeEvent.guests.length < 2}
                className="border border-paper bg-paper px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:border-ink-line disabled:bg-transparent disabled:text-mist"
              >
                {activeEvent.groups.length > 0 ? "Re-randomize teams" : "Randomize teams"}
              </button>
              <button
                type="button"
                onClick={addNewTeam}
                className="border border-ink-line px-5 py-2.5 text-sm text-paper-dim hover:text-paper"
              >
                + New team
              </button>
            </div>

            {unassigned.length > 0 && (
              <p className="mt-4 text-sm text-mist">
                Unassigned: {unassigned.map((id) => name(id)).join(", ")}
              </p>
            )}

            {activeEvent.groups.length > 0 && (
              <>
                <div className="mt-6 grid gap-px bg-ink-line sm:grid-cols-2 lg:grid-cols-3">
                  {activeEvent.groups.map((team, i) => (
                    <div key={i} className="bg-ink p-5">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          className="w-full border-none bg-transparent font-display text-xl text-paper outline-none"
                          value={team.name}
                          onChange={(e) => renameTeam(i, e.target.value)}
                        />
                        <span className="shrink-0 text-xs text-mist">{team.players.length}/{TEAM_SIZE}</span>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-paper-dim">
                        {team.players.map((id) => (
                          <li key={String(id)} className="flex items-center justify-between">
                            <span>{name(id)}</span>
                            <button type="button" onClick={() => removeFromTeam(i, id)} className="text-mist hover:text-loss">
                              ✕
                            </button>
                          </li>
                        ))}
                      </ul>
                      {team.players.length < TEAM_SIZE && unassigned.length > 0 && (
                        <select
                          className={`${inputClass} mt-3`}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) assignToTeam(i, parseParticipant(e.target.value));
                          }}
                        >
                          <option value="">+ Add player (late arrival)…</option>
                          {unassigned.map((id) => (
                            <option key={String(id)} value={String(id)}>
                              {name(id)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>

                {activeEvent.groups.length > 2 && (
                  <div className="mt-6 grid gap-4 sm:max-w-lg sm:grid-cols-2">
                    <label className={labelClass}>
                      Kicking off — Side 1
                      <select className={inputClass} value={playA} onChange={(e) => setPlayA(Number(e.target.value))}>
                        {activeEvent.groups.map((t, i) => (
                          <option key={i} value={i} disabled={i === playB}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={labelClass}>
                      Kicking off — Side 2
                      <select className={inputClass} value={playB} onChange={(e) => setPlayB(Number(e.target.value))}>
                        {activeEvent.groups.map((t, i) => (
                          <option key={i} value={i} disabled={i === playA}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={startGame}
                  disabled={activeEvent.groups.length < 2 || playA === playB}
                  className="mt-6 border border-win bg-win px-5 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-win disabled:cursor-not-allowed disabled:border-ink-line disabled:bg-transparent disabled:text-mist"
                >
                  Start match — 10:00 on the clock
                </button>
              </>
            )}
          </div>

          {pastGames.length > 0 && (
            <div>
              <h2 className="font-display text-2xl text-paper">Played so far</h2>
              <div className="mt-3 space-y-2">
                {pastGames.map((g) => (
                  <div key={g.id} className="border border-ink-line bg-ink-raised p-4 text-sm text-paper-dim">
                    {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeEvent && liveGame && (
        <div className="mt-8 space-y-10">
          <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 border-y border-ink-line bg-ink-raised/95 px-4 py-4 backdrop-blur md:static md:mx-0 md:border md:p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
              <div className="min-w-0 text-center md:text-left">
                <p className="truncate text-xs uppercase tracking-wide text-mist">{liveGame.teams[0].name}</p>
                <p className="font-display text-5xl leading-none text-paper">{scoreOf(liveGame, 0)}</p>
              </div>

              <div className="text-center">
                <p className="text-[0.65rem] uppercase tracking-wide text-mist md:text-xs">
                  {timer.isFinished ? "Time's up" : `First to ${WIN_GOALS} wins`}
                </p>
                <p className="font-display text-5xl leading-none tabular-nums text-paper md:text-6xl">{formatClock(timer.secondsLeft)}</p>
              </div>

              <div className="min-w-0 text-center md:text-right">
                <p className="truncate text-xs uppercase tracking-wide text-mist">{liveGame.teams[1].name}</p>
                <p className="font-display text-5xl leading-none text-paper">{scoreOf(liveGame, 1)}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 md:mx-auto md:mt-4 md:flex md:justify-center">
              <button
                type="button"
                onClick={timer.running ? timer.pause : timer.start}
                disabled={timer.isFinished}
                className="border border-paper bg-paper px-4 py-2.5 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:border-ink-line disabled:bg-transparent disabled:text-mist md:py-2"
              >
                {timer.running ? "Pause" : "Start"}
              </button>
              <button
                type="button"
                onClick={timer.reset}
                className="border border-ink-line px-4 py-2.5 text-sm text-paper-dim hover:text-paper md:py-2"
              >
                Reset to 10:00
              </button>
            </div>
          </div>

          <div className="grid gap-px bg-ink-line md:grid-cols-2">
            <div className="bg-ink p-4 md:p-6">
              <h2 className="font-display text-xl text-paper">Log a goal</h2>
              <div className="mt-4 flex gap-2">
                {([0, 1] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setGoalTeam(t);
                      setGoalPlayer("");
                      setAssistPlayer("");
                    }}
                    className={`flex-1 border px-3 py-2 text-sm ${
                      goalTeam === t ? "border-paper bg-paper text-ink" : "border-ink-line text-paper-dim hover:text-paper"
                    }`}
                  >
                    {liveGame.teams[t].name}
                  </button>
                ))}
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-paper-dim">
                <input
                  type="checkbox"
                  checked={ownGoal}
                  onChange={(e) => {
                    setOwnGoal(e.target.checked);
                    setGoalPlayer("");
                    setAssistPlayer("");
                  }}
                  className="h-4 w-4 accent-paper"
                />
                Own goal (credits {liveGame.teams[goalTeam].name})
              </label>

              <select
                className={`${inputClass} mt-3`}
                value={goalPlayer}
                onChange={(e) => setGoalPlayer(e.target.value ? parseParticipant(e.target.value) : "")}
              >
                <option value="">{ownGoal ? "Player who scored the own goal…" : "Scorer…"}</option>
                {liveGame.teams[ownGoal ? (goalTeam === 0 ? 1 : 0) : goalTeam].players.map((id) => (
                  <option key={String(id)} value={String(id)}>
                    {name(id)}
                  </option>
                ))}
              </select>

              {!ownGoal && (
                <select
                  className={`${inputClass} mt-3`}
                  value={assistPlayer}
                  onChange={(e) => setAssistPlayer(e.target.value ? parseParticipant(e.target.value) : "")}
                >
                  <option value="">Assist (optional)…</option>
                  {liveGame.teams[goalTeam].players
                    .filter((id) => id !== goalPlayer)
                    .map((id) => (
                      <option key={String(id)} value={String(id)}>
                        {name(id)}
                      </option>
                    ))}
                </select>
              )}

              <button
                type="button"
                onClick={addGoal}
                disabled={goalPlayer === ""}
                className="mt-3 border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:border-ink-line disabled:bg-transparent disabled:text-mist"
              >
                Add goal
              </button>

              <ul className="mt-5 space-y-2 text-sm">
                {liveGame.goals.length === 0 && <li className="text-mist">No goals yet.</li>}
                {liveGame.goals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between border-b border-ink-line pb-2">
                    <span className="text-paper-dim">
                      {g.minute}' — {name(g.playerId)}
                      {g.ownGoal && <span className="text-mist"> (o.g.)</span>}
                      {g.assistPlayerId !== undefined && (
                        <span className="text-mist"> · assist {name(g.assistPlayerId)}</span>
                      )}{" "}
                      <span className="text-mist">({liveGame.teams[g.teamIndex].name})</span>
                    </span>
                    <button type="button" onClick={() => removeGoal(g.id)} className="text-mist hover:text-loss">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-ink p-4 md:p-6">
              <h2 className="font-display text-xl text-paper">Log a card</h2>
              <div className="mt-4 flex gap-2">
                {([0, 1] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setCardTeam(t);
                      setCardPlayer("");
                    }}
                    className={`flex-1 border px-3 py-2 text-sm ${
                      cardTeam === t ? "border-paper bg-paper text-ink" : "border-ink-line text-paper-dim hover:text-paper"
                    }`}
                  >
                    {liveGame.teams[t].name}
                  </button>
                ))}
              </div>
              <select
                className={`${inputClass} mt-3`}
                value={cardPlayer}
                onChange={(e) => setCardPlayer(e.target.value ? parseParticipant(e.target.value) : "")}
              >
                <option value="">Player…</option>
                {liveGame.teams[cardTeam].players.map((id) => (
                  <option key={String(id)} value={String(id)}>
                    {name(id)}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <select className={inputClass} value={cardType} onChange={(e) => setCardType(e.target.value as "yellow" | "red")}>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                </select>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Reason"
                  value={cardReason}
                  onChange={(e) => setCardReason(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={addCard}
                disabled={cardPlayer === ""}
                className="mt-3 border border-paper bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-transparent hover:text-paper disabled:cursor-not-allowed disabled:border-ink-line disabled:bg-transparent disabled:text-mist"
              >
                Add card
              </button>

              <ul className="mt-5 space-y-2 text-sm">
                {liveGame.cards.length === 0 && <li className="text-mist">No cards yet.</li>}
                {liveGame.cards.map((c) => (
                  <li key={c.id} className="flex items-center justify-between border-b border-ink-line pb-2">
                    <span className="text-paper-dim">
                      {c.minute}' —{" "}
                      <span className={c.type === "red" ? "text-loss" : "text-draw"}>
                        {c.type === "red" ? "Red" : "Yellow"}
                      </span>{" "}
                      {name(c.playerId)}
                      <span className="text-mist"> · {c.reason}</span>
                    </span>
                    <button type="button" onClick={() => removeCard(c.id)} className="text-mist hover:text-loss">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-ink border border-ink-line p-6">
            <h2 className="font-display text-xl text-paper">Substitute</h2>
            <p className="mt-1 text-sm text-mist">Swap a tired or injured player for someone on the bench.</p>
            <div className="mt-4 flex gap-2">
              {([0, 1] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSubTeam(t);
                    setSubOff("");
                  }}
                  className={`flex-1 border px-3 py-2 text-sm ${
                    subTeam === t ? "border-paper bg-paper text-ink" : "border-ink-line text-paper-dim hover:text-paper"
                  }`}
                >
                  {liveGame.teams[t].name}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                className={inputClass}
                value={subOff}
                onChange={(e) => setSubOff(e.target.value ? parseParticipant(e.target.value) : "")}
              >
                <option value="">Player off…</option>
                {liveGame.teams[subTeam].players.map((id) => (
                  <option key={String(id)} value={String(id)}>
                    {name(id)}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={subOn}
                onChange={(e) => setSubOn(e.target.value ? parseParticipant(e.target.value) : "")}
              >
                <option value="">Player on (bench)…</option>
                {benchIds.map((id) => (
                  <option key={String(id)} value={String(id)}>
                    {name(id)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={substitute}
              disabled={subOff === "" || subOn === ""}
              className="mt-3 border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper disabled:cursor-not-allowed disabled:text-mist"
            >
              Substitute
            </button>
          </div>

          <button
            type="button"
            onClick={endGame}
            className="border border-loss bg-loss px-5 py-2.5 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
          >
            End match
          </button>
        </div>
      )}

      {addingPlayer && (
        <PlayerFormModal
          initial={null}
          suggestedNumber={nextJerseyNumber(players)}
          onClose={() => setAddingPlayer(false)}
          onSubmit={handleAddPlayer}
        />
      )}

      {confirmEnd && activeEvent && (
        <div
          className="sheet-backdrop"
          onClick={() => setConfirmEnd(false)}
        >
          <div role="dialog" aria-modal="true" className="sheet md:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl text-paper">End match day</h2>
            <p className="mt-2 text-sm text-paper-dim">
              This finishes any game still in progress and turns "
              {activeEvent.title}" into a view-only record in Matches. This can't be undone.
            </p>
            <div className="sheet-actions mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="border border-ink-line px-4 py-2 text-sm text-paper-dim hover:text-paper"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={endMatchDay}
                className="border border-loss bg-loss px-4 py-2 text-sm font-medium text-paper hover:bg-transparent hover:text-loss"
              >
                End match day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
