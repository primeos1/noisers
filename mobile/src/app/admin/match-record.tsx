import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { participantName, plural, scoreOf } from "../../lib/derive";
import type { MatchDayCard, MatchDayGame, MatchDayGoal, ParticipantId } from "../../lib/types";
import { Choice, FormError, Hint, Intro, Label, Section, TextField, confirm } from "../../components/form";
import { Button, Empty, RefCard, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

let idCounter = 0;
function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}${Date.now()}${idCounter}`;
}

function teamOf(game: MatchDayGame, id: ParticipantId): 0 | 1 {
  return game.teams[1].players.includes(id) ? 1 : 0;
}

/**
 * Edits an ended match day's record (Settings → Match records): its details,
 * each game's goals and cards, or deleting games outright. Nothing is saved
 * until "Save changes"; the server then brings stats, fines, ratings and
 * The Vale in line with the corrected record. Same as the web's
 * MatchRecordEditor.
 */
export default function MatchRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events } = useClub();
  const event = events.find((e) => e.id === id);

  if (!event) {
    return (
      <Screen>
        <Empty>That match day is no longer there.</Empty>
      </Screen>
    );
  }
  return <Editor key={event.id} eventId={event.id} />;
}

function Editor({ eventId }: { eventId: string }) {
  const { events, players, updateEvent, refresh } = useClub();
  // Read once — saving patches the shared event optimistically.
  const [event] = useState(() => events.find((e) => e.id === eventId)!);

  const [title, setTitle] = useState(event.title);
  const [venue, setVenue] = useState(event.venue ?? "");
  const [date, setDate] = useState(event.date);
  const [games, setGames] = useState<MatchDayGame[]>(event.games);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const name = (pid: ParticipantId) => participantName(players, event.guests, pid);
  const deleted = event.games.length - games.length;

  function patchGame(gameId: string, update: (game: MatchDayGame) => MatchDayGame) {
    setGames((prev) => prev.map((g) => (g.id === gameId ? update(g) : g)));
  }

  function patchGoal(gameId: string, goalId: string, patch: Partial<MatchDayGoal>) {
    patchGame(gameId, (g) => ({
      ...g,
      goals: g.goals.map((goal) => {
        if (goal.id !== goalId) return goal;
        const next = { ...goal, ...patch };
        // The scorer comes from the credited team, or the other one for an own goal.
        const scorerSide = g.teams[next.ownGoal ? 1 - next.teamIndex : next.teamIndex].players;
        if (!scorerSide.includes(next.playerId)) next.playerId = scorerSide[0];
        if (next.ownGoal || (next.assistPlayerId != null && !g.teams[next.teamIndex].players.includes(next.assistPlayerId))) {
          next.assistPlayerId = null;
        }
        return next;
      }),
    }));
  }

  function patchCard(gameId: string, cardId: string, patch: Partial<MatchDayCard>) {
    patchGame(gameId, (g) => ({
      ...g,
      cards: g.cards.map((c) => {
        if (c.id !== cardId) return c;
        const next = { ...c, ...patch };
        return { ...next, teamIndex: teamOf(g, next.playerId) };
      }),
    }));
  }

  function addGoal(game: MatchDayGame) {
    const goal: MatchDayGoal = { id: newId("g"), teamIndex: 0, playerId: game.teams[0].players[0], ownGoal: false, minute: 0 };
    patchGame(game.id, (g) => ({ ...g, goals: [...g.goals, goal] }));
    setOpen(goal.id);
  }

  function addCard(game: MatchDayGame) {
    const playerId = game.teams[0].players[0] ?? game.teams[1].players[0];
    const card: MatchDayCard = { id: newId("c"), teamIndex: teamOf(game, playerId), playerId, type: "yellow", reason: "", minute: 0 };
    patchGame(game.id, (g) => ({ ...g, cards: [...g.cards, card] }));
    setOpen(card.id);
  }

  function deleteGame(game: MatchDayGame, index: number) {
    confirm(
      "Delete this game?",
      `Game ${index + 1} (${game.teams[0].name} ${scoreOf(game, 0)}–${scoreOf(game, 1)} ${game.teams[1].name}) and its goals and cards are removed when you save.`,
      "Delete",
      () => setGames((prev) => prev.filter((g) => g.id !== game.id)),
    );
  }

  async function save() {
    if (!title.trim() || !date.trim()) {
      setError("A match day needs a title and a date.");
      return;
    }
    if (games.some((g) => g.goals.some((x) => x.playerId == null) || g.cards.some((x) => x.playerId == null))) {
      setError("Every goal and card needs a player.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await updateEvent(event.id, {
        title: title.trim(),
        venue: venue.trim(),
        date: date.trim(),
        games: games.map((g) => ({
          ...g,
          cards: g.cards.map((c) => ({ ...c, reason: c.reason.trim() || (c.type === "yellow" ? "Yellow card" : "Red card") })),
        })),
      });
      // Cards, ratings and The Vale all moved on the server.
      await refresh();
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the match record."));
      setSaving(false);
      refresh();
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Screen>
        <Intro>Fix goals and cards, or delete games that shouldn’t count. Stats, fines, ratings and The Vale update when you save.</Intro>

        <Section title="Details">
          <TextField label="Title" value={title} onChangeText={setTitle} />
          <TextField label="Venue" value={venue} onChangeText={setVenue} />
          <TextField label="Date" value={date} onChangeText={setDate} />
        </Section>

        {games.length === 0 ? <Hint>No games left. The match day stays, but won’t count towards anyone’s stats.</Hint> : null}

        {games.map((game) => {
          const index = event.games.findIndex((g) => g.id === game.id);
          const everyone = [...game.teams[0].players, ...game.teams[1].players];
          return (
            <Section
              key={game.id}
              title={`Game ${index + 1}`}
              description={`${game.teams[0].name} ${scoreOf(game, 0)}–${scoreOf(game, 1)} ${game.teams[1].name}${game.status !== "finished" ? " · not finished, doesn't count" : ""}`}
              aside={
                <Pressable onPress={() => deleteGame(game, index)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete game ${index + 1}`}>
                  <Txt style={styles.danger}>Delete game</Txt>
                </Pressable>
              }
            >
              <Label>Goals</Label>
              {game.goals.length === 0 ? <Txt style={[text.small, styles.none]}>No goals.</Txt> : null}
              {game.goals.map((goal) => {
                const scorerSide = game.teams[goal.ownGoal ? 1 - goal.teamIndex : goal.teamIndex].players;
                const teammates = game.teams[goal.teamIndex].players.filter((p) => p !== goal.playerId);
                const expanded = open === goal.id;
                return (
                  <View key={goal.id} style={styles.item}>
                    <Pressable onPress={() => setOpen(expanded ? null : goal.id)} accessibilityRole="button" style={styles.itemHead}>
                      <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                        {goal.playerId != null ? name(goal.playerId) : "Pick a scorer"}
                        {goal.ownGoal ? " (o.g.)" : goal.assistPlayerId != null ? `, assist ${name(goal.assistPlayerId)}` : ""}
                      </Txt>
                      <Txt style={text.small}>{game.teams[goal.teamIndex].name}</Txt>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.itemBody}>
                        <Label>Goal for</Label>
                        <Choice<0 | 1>
                          options={[
                            { value: 0, label: game.teams[0].name },
                            { value: 1, label: game.teams[1].name },
                          ]}
                          value={goal.teamIndex}
                          onChange={(v) => patchGoal(game.id, goal.id, { teamIndex: v })}
                        />
                        <Choice<"goal" | "own">
                          options={[
                            { value: "goal", label: "Goal" },
                            { value: "own", label: "Own goal" },
                          ]}
                          value={goal.ownGoal ? "own" : "goal"}
                          onChange={(v) => patchGoal(game.id, goal.id, { ownGoal: v === "own" })}
                        />
                        <Label>{goal.ownGoal ? "Who put it in their own net" : "Scorer"}</Label>
                        <Choice<ParticipantId>
                          options={scorerSide.map((p) => ({ value: p, label: name(p) }))}
                          value={goal.playerId}
                          onChange={(v) => patchGoal(game.id, goal.id, { playerId: v })}
                        />
                        {!goal.ownGoal ? (
                          <>
                            <Label>Assist</Label>
                            <Choice<ParticipantId>
                              options={[{ value: "", label: "No assist" }, ...teammates.map((p) => ({ value: p, label: name(p) }))]}
                              value={goal.assistPlayerId ?? ""}
                              onChange={(v) => patchGoal(game.id, goal.id, { assistPlayerId: v === "" ? null : v })}
                            />
                          </>
                        ) : null}
                        <Pressable
                          onPress={() => patchGame(game.id, (g) => ({ ...g, goals: g.goals.filter((x) => x.id !== goal.id) }))}
                          accessibilityRole="button"
                          hitSlop={8}
                        >
                          <Txt style={styles.danger}>Remove goal</Txt>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {everyone.length > 0 ? (
                <Pressable onPress={() => addGoal(game)} accessibilityRole="button" hitSlop={8} style={styles.add}>
                  <Txt style={styles.link}>+ Add goal</Txt>
                </Pressable>
              ) : null}

              <Label>Cards</Label>
              {game.cards.length === 0 ? <Txt style={[text.small, styles.none]}>No cards.</Txt> : null}
              {game.cards.map((card) => {
                const expanded = open === card.id;
                return (
                  <View key={card.id} style={styles.item}>
                    <Pressable onPress={() => setOpen(expanded ? null : card.id)} accessibilityRole="button" style={styles.itemHead}>
                      <RefCard type={card.type} />
                      <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                        {card.playerId != null ? name(card.playerId) : "Pick a player"}
                      </Txt>
                      <Txt style={[text.small, styles.reason]} numberOfLines={1}>
                        {card.reason}
                      </Txt>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.itemBody}>
                        <Label>Player</Label>
                        <Choice<ParticipantId>
                          options={everyone.map((p) => ({ value: p, label: name(p) }))}
                          value={card.playerId}
                          onChange={(v) => patchCard(game.id, card.id, { playerId: v })}
                        />
                        <Segmented<"yellow" | "red">
                          value={card.type}
                          onChange={(v) => patchCard(game.id, card.id, { type: v })}
                          options={[
                            { value: "yellow", label: "Yellow" },
                            { value: "red", label: "Red" },
                          ]}
                        />
                        <View style={styles.gap} />
                        <TextField
                          label="Reason"
                          value={card.reason}
                          onChangeText={(v) => patchCard(game.id, card.id, { reason: v })}
                          placeholder="Dissent, late challenge…"
                        />
                        <Pressable
                          onPress={() => patchGame(game.id, (g) => ({ ...g, cards: g.cards.filter((x) => x.id !== card.id) }))}
                          accessibilityRole="button"
                          hitSlop={8}
                        >
                          <Txt style={styles.danger}>Remove card</Txt>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {everyone.length > 0 ? (
                <Pressable onPress={() => addCard(game)} accessibilityRole="button" hitSlop={8} style={styles.add}>
                  <Txt style={styles.link}>+ Add card</Txt>
                </Pressable>
              ) : null}
            </Section>
          );
        })}

        <Hint>
          Saving updates appearances, goals, assists and clean sheets, cards and fines (paid fines stay paid), player ratings, and The Vale if it’s
          showing this match day.
        </Hint>
        {deleted > 0 ? <Hint tone={colors.loss}>{plural(deleted, "game")} will be deleted, with their goals and cards.</Hint> : null}
        <View style={styles.gap} />
        <FormError message={error} />
        <Button label="Save changes" onPress={save} busy={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { height: space.lg },
  none: { marginBottom: space.md },
  item: { backgroundColor: colors.ink, borderRadius: 12, marginBottom: space.sm, overflow: "hidden" },
  itemHead: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48, paddingHorizontal: space.md },
  itemBody: { paddingHorizontal: space.md, paddingBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine, paddingTop: space.md },
  reason: { maxWidth: "40%" },
  add: { marginBottom: space.lg, marginTop: space.xs, borderRadius: radius.sm },
  link: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim, textDecorationLine: "underline" },
  danger: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.loss },
});
