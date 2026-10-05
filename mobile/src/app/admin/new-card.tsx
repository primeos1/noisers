import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { formatNaira, scoreOf, sortEvents } from "../../lib/derive";
import type { CardType, MatchDayGame } from "../../lib/types";
import { Choice, Hint } from "../../components/form";
import { Button, RefCard, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

export default function NewCardScreen() {
  const { players, settings, events, addCard, updateEvent, refresh } = useClub();
  const [eventId, setEventId] = useState("");
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [type, setType] = useState<CardType>("yellow");
  const [reason, setReason] = useState("");
  const [fineOverride, setFineOverride] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const squad = useMemo(
    () => [...players].filter((p) => p.active).sort((a, b) => a.number - b.number || a.name.localeCompare(b.name)),
    [players],
  );

  // Recent finished match days a missed card can be added to.
  const matchDays = sortEvents(events).filter((e) => e.status === "ended" && e.games.length > 0).slice(0, 8);
  const event = matchDays.find((e) => e.id === eventId);
  const game = event?.games.find((g) => g.id === gameId);
  // Linked to a game, only the squad players who played in it can be booked.
  const choices = game ? squad.filter((p) => game.teams.some((t) => t.players.includes(p.id))) : squad;

  const defaultFine = type === "red" ? settings.redCardFine : settings.yellowCardFine;
  const fineText = fineOverride ?? String(defaultFine);
  const fine = Number(fineText.replace(/[^0-9.]/g, ""));
  const selected = choices.find((p) => p.id === playerId);

  // A card missed during a match day goes into that game's record; the
  // server then logs its fine and updates stats, ratings and The Vale.
  async function addToGame(id: string, target: MatchDayGame, player: number) {
    const cardId = `c${Date.now()}`;
    const cardReason = reason.trim() || (type === "yellow" ? "Yellow card" : "Red card");
    try {
      // Built on the latest copy, in case someone is editing that match day too.
      await updateEvent(id, (e) => ({
        games: e.games.map((g) =>
          g.id !== target.id
            ? g
            : {
                ...g,
                cards: [
                  ...g.cards,
                  {
                    id: cardId,
                    teamIndex: g.teams[1].players.includes(player) ? (1 as const) : (0 as const),
                    playerId: player,
                    type,
                    reason: cardReason,
                    minute: 0,
                  },
                ],
              },
        ),
      }));
    } finally {
      await refresh();
    }
  }

  async function submit() {
    if (event && !game) {
      setError("Pick the game the card was given in.");
      return;
    }
    if (playerId === null) {
      setError("Pick the player who was booked.");
      return;
    }
    if (!event && (!Number.isFinite(fine) || fine < 0)) {
      setError("Enter a fine of ₦0 or more.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (event && game) {
        await addToGame(event.id, game, playerId);
      } else {
        await addCard({ playerId, type, reason: reason.trim(), fineAmount: fine, paid });
      }
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't log that card."));
      setBusy(false);
    }
  }

  return (
    <Screen>
      {matchDays.length > 0 ? (
        <>
          <Txt style={styles.label}>Match day</Txt>
          <Choice<string>
            options={[{ value: "", label: "Not from a match day" }, ...matchDays.map((m) => ({ value: m.id, label: `${m.title} · ${m.date}` }))]}
            value={eventId}
            onChange={(v) => {
              setEventId(v);
              setGameId("");
            }}
          />
          {event ? (
            <>
              <Txt style={styles.label}>Game</Txt>
              <Choice<string>
                options={event.games.map((g, i) => ({
                  value: g.id,
                  label: `Game ${i + 1}: ${g.teams[0].name} ${scoreOf(g, 0)}–${scoreOf(g, 1)} ${g.teams[1].name}`,
                }))}
                value={gameId}
                onChange={(v) => {
                  setGameId(v);
                  const next = event.games.find((g) => g.id === v);
                  if (playerId !== null && next && !next.teams.some((t) => t.players.includes(playerId))) setPlayerId(null);
                }}
              />
              <Hint>The card goes into that game’s record, so it also counts in the player’s stats, rating and The Vale. The club fine applies.</Hint>
              <View style={styles.gapLg} />
            </>
          ) : null}
        </>
      ) : null}

      <Txt style={styles.label}>Player</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shirts} keyboardShouldPersistTaps="handled">
        {(event && !game ? [] : choices).map((p) => {
          const active = p.id === playerId;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPlayerId(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${p.name}, number ${p.number}`}
              style={[styles.shirt, active ? styles.shirtActive : null]}
            >
              <Txt style={[styles.shirtNumber, active ? styles.shirtNumberActive : null]}>{p.number}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <Txt style={[text.dim, styles.selected]}>{selected ? selected.name : event && !game ? "Pick the game first" : "Tap a shirt number"}</Txt>

      <Txt style={styles.label}>Card</Txt>
      <Segmented<CardType>
        value={type}
        onChange={(t) => {
          setType(t);
          setFineOverride(null);
        }}
        options={[
          { value: "yellow", label: "Yellow" },
          { value: "red", label: "Red" },
        ]}
      />

      <Txt style={styles.label}>Reason (optional)</Txt>
      <TextInput
        value={reason}
        onChangeText={setReason}
        style={styles.input}
        placeholder="Dissent, late challenge…"
        placeholderTextColor={colors.mist}
        maxLength={255}
        accessibilityLabel="Reason"
      />

      {/* A match day card is priced by the server at the club fine. */}
      {!event ? (
        <>
          <Txt style={styles.label}>Fine (₦)</Txt>
          <TextInput
            value={fineText}
            onChangeText={setFineOverride}
            style={styles.input}
            keyboardType="number-pad"
            accessibilityLabel="Fine in naira"
          />
          <Txt style={[text.small, styles.hint]}>Club default for a {type} card is {formatNaira(defaultFine)}.</Txt>

          <View style={styles.switchRow}>
            <Txt style={[text.body, styles.flex]}>Already paid</Txt>
            <Switch value={paid} onValueChange={setPaid} trackColor={{ true: colors.win, false: colors.inkLine }} thumbColor={colors.paper} />
          </View>
        </>
      ) : null}

      <View style={styles.preview}>
        <RefCard type={type} size="md" />
        <Txt style={[text.dim, styles.flex]}>
          {selected ? `${selected.name}, ${type} card` : `${type === "red" ? "Red" : "Yellow"} card`}
        </Txt>
        <Txt style={text.semi}>{event ? formatNaira(defaultFine) : Number.isFinite(fine) ? formatNaira(fine) : "–"}</Txt>
      </View>

      {error ? (
        <Txt style={styles.error} accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <Button label="Log card" onPress={submit} busy={busy} disabled={playerId === null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gapLg: { height: space.lg },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim, marginBottom: space.sm, paddingHorizontal: 4 },
  shirts: { gap: space.sm, paddingBottom: 4 },
  shirt: { minWidth: 48, height: 48, borderRadius: 24, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine },
  shirtActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  shirtNumber: { fontFamily: fonts.display, fontSize: 20, color: colors.paper },
  shirtNumberActive: { color: colors.ink },
  selected: { marginTop: space.sm, marginBottom: space.xl, paddingHorizontal: 4 },
  input: {
    minHeight: 48,
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inkLine,
    paddingHorizontal: space.md,
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 16,
    marginBottom: space.lg,
  },
  hint: { marginTop: -8, marginBottom: space.lg, paddingHorizontal: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.inkRaised, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 56, marginBottom: space.xl },
  preview: { flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.inkLine, borderStyle: "dashed", padding: space.lg, marginBottom: space.lg },
  error: { color: colors.loss, fontSize: 14, marginBottom: space.md },
});
