import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useClub, type EventPatch } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { participantName, plural, scoreOf } from "../../lib/derive";
import {
  buildTeams,
  defaultTeamName,
  formatClock,
  formatEventDate,
  nextGuestId,
  uniqueEventId,
  useMatchTimer,
} from "../../lib/matchDay";
import type { MatchDayEvent, MatchDayGame, MatchDayTeam, ParticipantId, TeamMode } from "../../lib/types";
import { Choice, confirm, FormError, formStyles, Hint, Label, Section, SwitchRow, TextField, Intro } from "../../components/form";
import { Avatar, Button, ErrorBanner, Group, LiveTag, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

// The pitch-side Match Day tool — the phone version of
// frontend/src/pages/admin/MatchDay.tsx. Every change is saved to the API
// straight away, so the web admin and other phones see the same state.

const modeOptions: { value: TeamMode; label: string; hint: string }[] = [
  { value: "random", label: "Random", hint: "Just a shuffle" },
  { value: "rating", label: "By rating", hint: "Even strength" },
  { value: "position", label: "By position", hint: "Even positions" },
];

function tap() {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
}

/** Wrapping name chips — pick one participant. */
function PeoplePicker({
  ids,
  value,
  onChange,
  name,
  empty = "No one to pick.",
}: {
  ids: ParticipantId[];
  value: ParticipantId | null;
  onChange: (id: ParticipantId | null) => void;
  name: (id: ParticipantId) => string;
  empty?: string;
}) {
  if (ids.length === 0) return <Hint>{empty}</Hint>;
  return (
    <View style={styles.people}>
      {ids.map((id) => {
        const active = id === value;
        return (
          <Pressable
            key={String(id)}
            onPress={() => {
              tap();
              onChange(active ? null : id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.person, active ? styles.personActive : null]}
          >
            <Txt style={[styles.personText, active ? styles.personTextActive : null]} numberOfLines={1}>
              {name(id)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function CreateMatchDay({ onCreated }: { onCreated: (id: string) => void }) {
  const { events, settings, addEvent } = useClub();
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState(settings.matchDefaultVenue);
  const [dayOffset, setDayOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resumable = events.filter((e) => e.status === "live");

  const dayOptions = [-1, 0, 1].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return { value: offset, label: offset === 0 ? "Today" : offset < 0 ? "Yesterday" : "Tomorrow", hint: formatEventDate(d) };
  });

  async function create() {
    if (!title.trim() || !venue.trim()) {
      setError("Enter a title and venue.");
      return;
    }
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const id = uniqueEventId(title, events);
    setBusy(true);
    setError("");
    try {
      await addEvent({
        id,
        title: title.trim(),
        venue: venue.trim(),
        date: formatEventDate(date),
        createdAt: null,
        presentPlayers: [],
        guests: [],
        groups: [],
        games: [],
        status: "live",
      });
      onCreated(id);
    } catch (err) {
      setError(errorMessage(err, "Couldn't create that match day."));
      setBusy(false);
    }
  }

  return (
    <>
      <Intro>Internal squad sessions: pick who's here, split the teams, then run each game on the clock.</Intro>
      {resumable.length > 0 ? (
        <Group title="Resume an in-progress match day">
          {resumable.map((e) => (
            <Row key={e.id} onPress={() => onCreated(e.id)}>
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {e.title}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  {[e.venue, e.date].filter(Boolean).join(", ")}
                </Txt>
              </View>
              <LiveTag />
            </Row>
          ))}
        </Group>
      ) : null}

      <Section title="Create match day" description="Give this session a title, venue and date. Save it, then pick who's playing.">
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Sunday Session #12" autoCapitalize="words" />
        <TextField label="Venue" value={venue} onChangeText={setVenue} placeholder="e.g. Zenith Astro, Pitch 2" />
        <Label>Date</Label>
        <Choice<number> options={dayOptions} value={dayOffset} onChange={setDayOffset} />
        <FormError message={error} />
        <Button label="Save & continue" onPress={create} busy={busy} />
      </Section>
    </>
  );
}

function Setup({ event, patch }: { event: MatchDayEvent; patch: (p: EventPatch) => void }) {
  const { players, settings } = useClub();
  const [mode, setMode] = useState<TeamMode>(settings.matchDefaultTeamMode);
  const [sides, setSides] = useState<[number, number]>([0, 1]);
  const teamSize = settings.matchTeamSize;
  const name = (id: ParticipantId) => participantName(players, event.guests, id);

  const squad = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  const allPresent: ParticipantId[] = [...event.presentPlayers, ...event.guests.map((g) => g.id)];
  const assigned = new Set<ParticipantId>(event.groups.flatMap((t) => t.players));
  const unassigned = allPresent.filter((id) => !assigned.has(id));
  const [sideA, sideB] = sides[0] < event.groups.length && sides[1] < event.groups.length ? sides : [0, 1];
  const pastGames = event.games;

  function togglePresent(playerId: number) {
    tap();
    const has = event.presentPlayers.includes(playerId);
    patch({
      presentPlayers: has ? event.presentPlayers.filter((id) => id !== playerId) : [...event.presentPlayers, playerId],
      // Someone who went home can't stay on a team.
      groups: has ? event.groups.map((t) => ({ ...t, players: t.players.filter((p) => p !== playerId) })) : event.groups,
    });
  }

  function setGroups(groups: MatchDayTeam[]) {
    patch({ groups });
  }

  function randomize() {
    const groups = buildTeams(players, event.presentPlayers, event.guests, mode, teamSize);
    setGroups(groups);
    setSides([0, groups.length > 1 ? 1 : 0]);
  }

  function assign(index: number, id: ParticipantId) {
    tap();
    if (event.groups[index].players.length >= teamSize) return;
    setGroups(
      event.groups.map((t, i) => {
        const rest = t.players.filter((p) => p !== id);
        return i === index ? { ...t, players: [...rest, id] } : { ...t, players: rest };
      }),
    );
  }

  function startGame() {
    const a = event.groups[sideA];
    const b = event.groups[sideB];
    if (!a || !b || sideA === sideB) return;
    const game: MatchDayGame = {
      id: `g${Date.now()}`,
      teams: [
        { name: a.name, players: [...a.players] },
        { name: b.name, players: [...b.players] },
      ],
      goals: [],
      cards: [],
      status: "live",
      clockStartedAt: null,
      clockElapsed: 0,
    };
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    patch({ games: [...event.games, game] });
  }

  return (
    <>
      <Group
        title={`Who's present? ${event.presentPlayers.length}/${players.length}`}
        aside={
          <View style={styles.inline}>
            <Pressable onPress={() => patch({ presentPlayers: players.map((p) => p.id) })} hitSlop={6} accessibilityRole="button">
              <Txt style={styles.textButton}>All</Txt>
            </Pressable>
            <Pressable
              onPress={() => patch({ presentPlayers: [], groups: event.groups.map((t) => ({ ...t, players: t.players.filter((p) => typeof p === "string") })) })}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Txt style={styles.textButton}>None</Txt>
            </Pressable>
          </View>
        }
      >
        {squad.map((p) => {
          const present = event.presentPlayers.includes(p.id);
          return (
            <Row
              key={p.id}
              onPress={() => togglePresent(p.id)}
              chevron={false}
              accessibilityLabel={`${p.name}, ${present ? "present" : "not here"}`}
            >
              <Ionicons name={present ? "checkmark-circle" : "ellipse-outline"} size={24} color={present ? colors.win : colors.inkLine} />
              <Avatar player={p} size={34} />
              <View style={styles.flex}>
                <Txt style={[text.semi, present ? null : { color: colors.paperDim }]} numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt style={text.small}>
                  #{p.number} · {p.secondaryPosition ? `${p.position} / ${p.secondaryPosition}` : p.position}
                </Txt>
              </View>
              <Txt style={[text.semi, text.tabular]}>{p.rating.toFixed(2)}</Txt>
            </Row>
          );
        })}
        <Row onPress={() => router.push({ pathname: "/admin/player", params: { present: event.id } })}>
          <Ionicons name="person-add-outline" size={20} color={colors.paper} />
          <Txt style={[text.body, styles.flex]}>Add a new player</Txt>
        </Row>
      </Group>

      <Group
        title="Guests"
        aside={
          <Pressable
            onPress={() => patch({ guests: [...event.guests, { id: nextGuestId(event.guests), name: `Guest ${event.guests.length + 1}` }] })}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Txt style={styles.textButton}>+ Add guest</Txt>
          </Pressable>
        }
      >
        {event.guests.length === 0 ? (
          <Row>
            <Txt style={text.small}>Anyone outside the squad plays as a guest.</Txt>
          </Row>
        ) : (
          event.guests.map((g) => (
            <Row key={g.id}>
              <TextInput
                defaultValue={g.name}
                onEndEditing={(e) => {
                  const next = e.nativeEvent.text.trim();
                  if (next && next !== g.name) patch({ guests: event.guests.map((x) => (x.id === g.id ? { ...x, name: next } : x)) });
                }}
                style={[formStyles.input, styles.flex]}
                accessibilityLabel={`Name for ${g.id}`}
              />
              <Pressable
                onPress={() =>
                  patch({
                    guests: event.guests.filter((x) => x.id !== g.id),
                    groups: event.groups.map((t) => ({ ...t, players: t.players.filter((p) => p !== g.id) })),
                  })
                }
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${g.name}`}
              >
                <Ionicons name="close-circle" size={22} color={colors.mist} />
              </Pressable>
            </Row>
          ))
        )}
      </Group>

      <Section title="Teams" description={`${plural(allPresent.length, "player")} here · ${teamSize} a side`}>
        <Choice<TeamMode> options={modeOptions} value={mode} onChange={setMode} />
        <View style={styles.inlineButtons}>
          <View style={styles.flex}>
            <Button label={event.groups.length ? "Re-randomize" : "Randomize"} icon="shuffle" onPress={randomize} disabled={allPresent.length < 2} />
          </View>
          <View style={styles.flex}>
            <Button label="New team" variant="secondary" icon="add" onPress={() => setGroups([...event.groups, { name: defaultTeamName(event.groups.length), players: [] }])} />
          </View>
        </View>
        {unassigned.length > 0 ? <Hint>Not on a team: {unassigned.map(name).join(", ")}</Hint> : null}
      </Section>

      {event.groups.map((team, i) => (
        <View key={i} style={styles.team}>
          <View style={styles.teamHead}>
            <TextInput
              defaultValue={team.name}
              onEndEditing={(e) => {
                const next = e.nativeEvent.text.trim();
                if (next && next !== team.name) setGroups(event.groups.map((t, j) => (j === i ? { ...t, name: next } : t)));
              }}
              style={styles.teamName}
              accessibilityLabel={`Team ${i + 1} name`}
            />
            <Txt style={text.small}>
              {team.players.length}/{teamSize}
            </Txt>
            {team.players.length === 0 ? (
              <Pressable onPress={() => setGroups(event.groups.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${team.name}`}>
                <Ionicons name="trash-outline" size={18} color={colors.mist} />
              </Pressable>
            ) : null}
          </View>
          {team.players.map((id) => (
            <View key={String(id)} style={styles.teamPlayer}>
              <Txt style={[text.body, styles.flex]} numberOfLines={1}>
                {name(id)}
              </Txt>
              <Pressable
                onPress={() => setGroups(event.groups.map((t, j) => (j === i ? { ...t, players: t.players.filter((p) => p !== id) } : t)))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Take ${name(id)} off ${team.name}`}
              >
                <Ionicons name="close" size={18} color={colors.mist} />
              </Pressable>
            </View>
          ))}
          {team.players.length < teamSize && unassigned.length > 0 ? (
            <View style={styles.lateArrivals}>
              <Txt style={text.small}>Add a late arrival:</Txt>
              <PeoplePicker ids={unassigned} value={null} onChange={(id) => id !== null && assign(i, id)} name={name} />
            </View>
          ) : null}
        </View>
      ))}

      {event.groups.length >= 2 ? (
        <Section title="Kick off">
          {event.groups.length > 2 ? (
            <>
              <Label>Side 1</Label>
              <Choice<number> options={event.groups.map((t, i) => ({ value: i, label: t.name }))} value={sideA} onChange={(v) => setSides([v, v === sideB ? sideA : sideB])} />
              <Label>Side 2</Label>
              <Choice<number> options={event.groups.map((t, i) => ({ value: i, label: t.name }))} value={sideB} onChange={(v) => setSides([v === sideA ? sideB : sideA, v])} />
            </>
          ) : (
            <Hint>
              {event.groups[0].name} v {event.groups[1].name}
            </Hint>
          )}
          <View style={styles.gap} />
          <Button
            label={`Start match · ${formatClock(settings.matchGameMinutes * 60)} on the clock`}
            icon="play"
            onPress={startGame}
            disabled={sideA === sideB}
          />
        </Section>
      ) : null}

      {pastGames.length > 0 ? (
        <Group title="Played so far">
          {pastGames.map((g, i) => (
            <Row key={g.id}>
              <Txt style={text.small}>G{i + 1}</Txt>
              <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
              </Txt>
            </Row>
          ))}
        </Group>
      ) : null}
    </>
  );
}

function LiveGame({
  event,
  game,
  patch,
}: {
  event: MatchDayEvent;
  game: MatchDayGame;
  patch: (p: EventPatch) => Promise<boolean>;
}) {
  const { players, settings, refresh } = useClub();
  const winGoals = settings.matchWinGoals;
  const name = (id: ParticipantId) => participantName(players, event.guests, id);

  function updateGame(updater: (g: MatchDayGame) => MatchDayGame) {
    return patch({ games: event.games.map((g) => (g.id === game.id ? updater(g) : g)) });
  }

  const timer = useMatchTimer(game, (clock) => updateGame((g) => ({ ...g, ...clock })), settings.matchGameMinutes);

  // Squad stats only count finished games, so reload them once one is saved.
  function finish(updater: (g: MatchDayGame) => MatchDayGame = (g) => g) {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    updateGame((g) => ({ ...updater(g), ...timer.stoppedClock(), status: "finished" })).then((ok) => {
      if (ok) refresh();
    });
  }

  const [goalTeam, setGoalTeam] = useState<0 | 1>(0);
  const [ownGoal, setOwnGoal] = useState(false);
  const [scorer, setScorer] = useState<ParticipantId | null>(null);
  const [assist, setAssist] = useState<ParticipantId | null>(null);
  const [cardTeam, setCardTeam] = useState<0 | 1>(0);
  const [cardPlayer, setCardPlayer] = useState<ParticipantId | null>(null);
  const [cardType, setCardType] = useState<"yellow" | "red">("yellow");
  const [cardReason, setCardReason] = useState("");
  const [subTeam, setSubTeam] = useState<0 | 1>(0);
  const [subOff, setSubOff] = useState<ParticipantId | null>(null);
  const [subOn, setSubOn] = useState<ParticipantId | null>(null);

  const teamOptions = [
    { value: 0 as const, label: game.teams[0].name },
    { value: 1 as const, label: game.teams[1].name },
  ];
  const everyone: ParticipantId[] = [...event.presentPlayers, ...event.guests.map((g) => g.id)];
  const bench = everyone.filter((id) => !game.teams[0].players.includes(id) && !game.teams[1].players.includes(id));

  function addGoal() {
    if (scorer === null) return;
    const goals = [
      ...game.goals,
      { id: `g${Date.now()}`, teamIndex: goalTeam, playerId: scorer, assistPlayerId: !ownGoal ? assist : null, ownGoal, minute: timer.minute },
    ];
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    if (scoreOf({ goals }, 0) >= winGoals || scoreOf({ goals }, 1) >= winGoals) finish((g) => ({ ...g, goals }));
    else updateGame((g) => ({ ...g, goals }));
    setScorer(null);
    setAssist(null);
    setOwnGoal(false);
  }

  function addCard() {
    if (cardPlayer === null) return;
    updateGame((g) => ({
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
    setCardPlayer(null);
    setCardReason("");
  }

  function substitute() {
    if (subOff === null || subOn === null) return;
    updateGame((g) => {
      const teams = [...g.teams] as [MatchDayTeam, MatchDayTeam];
      teams[subTeam] = { ...teams[subTeam], players: [...teams[subTeam].players.filter((id) => id !== subOff), subOn] };
      return { ...g, teams };
    });
    setSubOff(null);
    setSubOn(null);
  }

  // The scorer comes from the other side for an own goal.
  const scorerPool = game.teams[ownGoal ? (goalTeam === 0 ? 1 : 0) : goalTeam].players;

  return (
    <>
      <View style={styles.scoreboard}>
        <View style={styles.scoreRow}>
          <View style={styles.side}>
            <Txt style={styles.sideName} numberOfLines={1}>
              {game.teams[0].name}
            </Txt>
            <Txt style={styles.bigScore}>{scoreOf(game, 0)}</Txt>
          </View>
          <View style={styles.clockBox}>
            <Txt style={styles.clockHint}>{timer.isFinished ? "Time's up" : `First to ${winGoals}`}</Txt>
            <Txt style={[styles.clock, timer.running ? null : { color: colors.paperDim }]} accessibilityLabel={`${formatClock(timer.secondsLeft)} left`}>
              {formatClock(timer.secondsLeft)}
            </Txt>
          </View>
          <View style={styles.side}>
            <Txt style={styles.sideName} numberOfLines={1}>
              {game.teams[1].name}
            </Txt>
            <Txt style={styles.bigScore}>{scoreOf(game, 1)}</Txt>
          </View>
        </View>
        <View style={styles.inlineButtons}>
          <View style={styles.flex}>
            <Button
              label={timer.running ? "Pause" : "Start clock"}
              icon={timer.running ? "pause" : "play"}
              onPress={timer.running ? timer.pause : timer.start}
              disabled={timer.isFinished}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label="Reset"
              variant="secondary"
              icon="refresh"
              onPress={() => confirm("Reset the clock?", `Back to ${formatClock(settings.matchGameMinutes * 60)}.`, "Reset", timer.reset)}
            />
          </View>
        </View>
      </View>

      <Section title="Log a goal">
        <Choice<0 | 1>
          options={teamOptions}
          value={goalTeam}
          onChange={(t) => {
            setGoalTeam(t);
            setScorer(null);
            setAssist(null);
          }}
        />
        <SwitchRow
          label="Own goal"
          hint={`Counts for ${game.teams[goalTeam].name}; pick the player who put it in.`}
          value={ownGoal}
          onChange={(v) => {
            setOwnGoal(v);
            setScorer(null);
            setAssist(null);
          }}
        />
        <Label>{ownGoal ? "Who scored the own goal?" : "Scorer"}</Label>
        <PeoplePicker ids={scorerPool} value={scorer} onChange={setScorer} name={name} />
        {!ownGoal && scorer !== null ? (
          <>
            <Label>Assist (optional)</Label>
            <PeoplePicker ids={game.teams[goalTeam].players.filter((id) => id !== scorer)} value={assist} onChange={setAssist} name={name} empty="No teammates to credit." />
          </>
        ) : null}
        <View style={styles.gap} />
        <Button label="Add goal" icon="football" onPress={addGoal} disabled={scorer === null} />
        {game.goals.length ? (
          <View style={styles.log}>
            {game.goals.map((g) => (
              <View key={g.id} style={styles.logRow}>
                <Txt style={styles.minute}>{`${g.minute}'`}</Txt>
                <Txt style={[text.dim, styles.flex]}>
                  {name(g.playerId)}
                  {g.ownGoal ? " (o.g.)" : ""}
                  {g.assistPlayerId != null ? ` · assist ${name(g.assistPlayerId)}` : ""}
                  <Txt style={text.small}> ({game.teams[g.teamIndex].name})</Txt>
                </Txt>
                <Pressable
                  onPress={() => confirm("Remove goal?", `${name(g.playerId)}, ${g.minute}'`, "Remove", () => updateGame((x) => ({ ...x, goals: x.goals.filter((y) => y.id !== g.id) })))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove goal"
                >
                  <Ionicons name="close" size={18} color={colors.mist} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Hint>No goals yet.</Hint>
        )}
      </Section>

      <Section title="Log a card">
        <Choice<0 | 1>
          options={teamOptions}
          value={cardTeam}
          onChange={(t) => {
            setCardTeam(t);
            setCardPlayer(null);
          }}
        />
        <Label>Player</Label>
        <PeoplePicker ids={game.teams[cardTeam].players} value={cardPlayer} onChange={setCardPlayer} name={name} />
        <View style={styles.gap} />
        <Choice<"yellow" | "red">
          options={[
            { value: "yellow", label: "Yellow", tone: colors.draw },
            { value: "red", label: "Red", tone: colors.loss },
          ]}
          value={cardType}
          onChange={setCardType}
        />
        <TextField value={cardReason} onChangeText={setCardReason} placeholder="Reason (optional)" />
        <Button label="Add card" icon="albums-outline" onPress={addCard} disabled={cardPlayer === null} />
        {game.cards.length ? (
          <View style={styles.log}>
            {game.cards.map((c) => (
              <View key={c.id} style={styles.logRow}>
                <Txt style={styles.minute}>{`${c.minute}'`}</Txt>
                <View style={[styles.card, { backgroundColor: c.type === "red" ? colors.loss : colors.draw }]} />
                <Txt style={[text.dim, styles.flex]}>
                  {name(c.playerId)}
                  <Txt style={text.small}> · {c.reason}</Txt>
                </Txt>
                <Pressable
                  onPress={() => confirm("Remove card?", `${name(c.playerId)}, ${c.type}`, "Remove", () => updateGame((x) => ({ ...x, cards: x.cards.filter((y) => y.id !== c.id) })))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove card"
                >
                  <Ionicons name="close" size={18} color={colors.mist} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Hint>No cards yet.</Hint>
        )}
      </Section>

      <Section title="Substitute" description="Swap a tired or injured player for someone on the bench.">
        <Choice<0 | 1>
          options={teamOptions}
          value={subTeam}
          onChange={(t) => {
            setSubTeam(t);
            setSubOff(null);
          }}
        />
        <Label>Player off</Label>
        <PeoplePicker ids={game.teams[subTeam].players} value={subOff} onChange={setSubOff} name={name} />
        <View style={styles.gap} />
        <Label>Player on (bench)</Label>
        <PeoplePicker ids={bench} value={subOn} onChange={setSubOn} name={name} empty="Nobody on the bench." />
        <View style={styles.gap} />
        <Button label="Substitute" variant="secondary" icon="swap-horizontal" onPress={substitute} disabled={subOff === null || subOn === null} />
      </Section>

      <Button
        label="End match"
        variant="danger"
        icon="flag-outline"
        onPress={() =>
          confirm(
            "End this match?",
            `${game.teams[0].name} ${scoreOf(game, 0)}–${scoreOf(game, 1)} ${game.teams[1].name} goes in the books.`,
            "End match",
            () => finish(),
          )
        }
      />
    </>
  );
}

export default function MatchDayScreen() {
  const { events, settings, refresh, updateEvent } = useClub();
  // undefined = follow whichever match day is live; null = the create form.
  const [chosenId, setChosenId] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");

  const event = chosenId === undefined ? events.find((e) => e.status === "live") ?? null : events.find((e) => e.id === chosenId) ?? null;
  const liveGame = event?.games.find((g) => g.status === "live") ?? null;

  function patch(p: EventPatch) {
    if (!event) return Promise.resolve(false);
    setError("");
    return updateEvent(event.id, p)
      .then(() => true)
      .catch((err) => {
        setError(`${errorMessage(err, "Couldn't save that change.")} Check your connection and try again.`);
        return false;
      });
  }

  function endMatchDay() {
    if (!event) return;
    // Stop any running clock where it is, as the timer's stoppedClock() does.
    const stopped = (g: MatchDayGame) => {
      const run = g.clockStartedAt ? (Date.now() - g.clockStartedAt) / 1000 : 0;
      return { clockStartedAt: null, clockElapsed: Math.min((g.clockElapsed ?? 0) + run, settings.matchGameMinutes * 60) };
    };
    patch({
      games: event.games.map((g) => (g.status === "live" ? { ...g, ...stopped(g), status: "finished" as const } : g)),
      status: "ended",
    }).then((ok) => {
      // Ending the day files the fines and rewrites The Vale server-side.
      if (ok) refresh();
    });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Screen onRefresh={refresh}>
        {!event ? (
          <CreateMatchDay onCreated={setChosenId} />
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.flex}>
                <View style={styles.inline}>
                  <Txt style={styles.title} numberOfLines={2}>
                    {event.title}
                  </Txt>
                  {event.status === "live" ? <LiveTag /> : null}
                </View>
                <Txt style={text.small}>
                  {[event.venue, event.date, event.status === "ended" ? "Ended" : null].filter(Boolean).join(" · ")}
                </Txt>
              </View>
            </View>
            <ErrorBanner message={error} />

            {event.status === "ended" ? (
              <>
                <Hint>This match day has ended and is now view-only.</Hint>
                <View style={styles.gap} />
                <Group title="Games">
                  {event.games.length === 0 ? (
                    <Row>
                      <Txt style={text.small}>No games were played.</Txt>
                    </Row>
                  ) : (
                    event.games.map((g, i) => (
                      <Row key={g.id}>
                        <Txt style={text.small}>G{i + 1}</Txt>
                        <Txt style={[text.semi, styles.flex]}>
                          {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
                        </Txt>
                      </Row>
                    ))
                  )}
                </Group>
                <View style={styles.inlineButtons}>
                  <View style={styles.flex}>
                    <Button label="Match sheet" variant="secondary" icon="document-text-outline" onPress={() => router.push(`/match/${event.id}`)} />
                  </View>
                  <View style={styles.flex}>
                    <Button label="New match day" icon="add" onPress={() => setChosenId(null)} />
                  </View>
                </View>
              </>
            ) : liveGame ? (
              <LiveGame event={event} game={liveGame} patch={patch} />
            ) : (
              <Setup event={event} patch={patch} />
            )}

            {event.status === "live" ? (
              <View style={styles.endDay}>
                <Button
                  label="End match day"
                  variant="danger"
                  icon="stop-circle-outline"
                  onPress={() =>
                    confirm(
                      "End match day?",
                      `This finishes any game still in progress and turns "${event.title}" into a view-only record. Cards become fines and The Vale updates. This can't be undone.`,
                      "End match day",
                      endMatchDay,
                    )
                  }
                />
              </View>
            ) : null}
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { height: space.md },
  inline: { flexDirection: "row", alignItems: "center", gap: space.md },
  inlineButtons: { flexDirection: "row", gap: space.md, marginBottom: space.lg },
  textButton: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper },

  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: space.lg },
  title: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 34, color: colors.paper, flexShrink: 1 },
  endDay: { marginTop: space.xl },

  people: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  person: { maxWidth: "100%", minHeight: 40, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inkLine, backgroundColor: colors.ink, paddingHorizontal: space.md },
  personActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  personText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paperDim },
  personTextActive: { color: colors.ink, fontFamily: fonts.bodySemi },

  team: { backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.lg, marginBottom: space.md },
  teamHead: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.sm },
  teamName: { flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.paper, padding: 0 },
  teamPlayer: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },
  lateArrivals: { marginTop: space.md, gap: space.sm },

  scoreboard: { backgroundColor: colors.inkRaised, borderRadius: radius.lg, padding: space.lg, paddingBottom: 0, marginBottom: space.lg, borderWidth: 1, borderColor: colors.inkLine },
  scoreRow: { flexDirection: "row", alignItems: "center", marginBottom: space.lg },
  side: { flex: 1, alignItems: "center", minWidth: 0 },
  sideName: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: colors.mist },
  bigScore: { fontFamily: fonts.displayHeavy, fontSize: 56, lineHeight: 60, color: colors.paper, fontVariant: ["tabular-nums"] },
  clockBox: { alignItems: "center", paddingHorizontal: space.sm },
  clockHint: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.mist },
  clock: { fontFamily: fonts.display, fontSize: 44, lineHeight: 50, color: colors.paper, fontVariant: ["tabular-nums"] },

  log: { marginTop: space.lg, gap: space.sm },
  logRow: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingBottom: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inkLine },
  minute: { width: 30, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.mist, fontVariant: ["tabular-nums"] },
  card: { width: 10, height: 14, borderRadius: 2 },
});
