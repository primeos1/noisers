import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { positionLabel, positions, RATING_MAX, RATING_MIN } from "../../lib/derive";
import { nextJerseyNumber } from "../../lib/matchDay";
import type { Position } from "../../lib/types";
import { Choice, Col, FieldRow, FormError, Hint, ImageField, Label, NumberField, TextField } from "../../components/form";
import { Button, Figures, Screen } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Add a player, or edit one (`?number=7`). `?present=<event id>` also ticks
 * the new player as present on that match day — used from Match Day.
 */
export default function PlayerFormScreen() {
  const params = useLocalSearchParams<{ number?: string; present?: string }>();
  const { players, events, settings, addPlayer, updatePlayer, updateEvent } = useClub();
  const initial = params.number ? players.find((p) => p.number === Number(params.number)) : undefined;

  const [number, setNumber] = useState(initial?.number ?? nextJerseyNumber(players));
  const [name, setName] = useState(initial?.name ?? "");
  const [position, setPosition] = useState<Position>(initial?.position ?? "MID");
  const [rating, setRating] = useState(initial?.rating ?? settings.ratingNewPlayer);
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Jersey numbers identify players everywhere (cards, match days, awards).
  const numberOwner = players.find((p) => p.number === number && p.number !== initial?.number);

  async function submit() {
    if (!name.trim()) return setError("Enter a player name.");
    if (!Number.isInteger(number) || number < 1 || number > 99) return setError("Jersey number must be a whole number from 1 to 99.");
    if (numberOwner) return setError(`#${number} is already taken by ${numberOwner.name}. Pick another number.`);
    if (Number.isNaN(rating) || rating < RATING_MIN || rating > RATING_MAX) return setError(`Rating must be between ${RATING_MIN} and ${RATING_MAX}.`);

    setBusy(true);
    setError("");
    try {
      const input = { number, name, position, rating, photoUrl: photoUrl.trim() || null };
      if (initial) {
        await updatePlayer(initial.number, input);
      } else {
        await addPlayer(input);
        const event = params.present ? events.find((e) => e.id === params.present) : undefined;
        if (event) await updateEvent(event.id, { presentPlayers: [...event.presentPlayers, number] });
      }
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that player."));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Stack.Screen options={{ title: initial ? "Edit player" : "Add player" }} />

        <FieldRow>
          <Col>
            <NumberField label="Jersey number" value={number} onChange={setNumber} hint={numberOwner ? `Taken by ${numberOwner.name}` : undefined} />
          </Col>
          <Col>
            <NumberField label="Rating" value={rating} onChange={setRating} decimal />
          </Col>
        </FieldRow>

        <TextField label="Full name" value={name} onChangeText={setName} placeholder="e.g. Segun Owolabi" autoCapitalize="words" />

        <Label>Position</Label>
        <Choice<Position> value={position} onChange={setPosition} options={positions.map((p) => ({ value: p, label: positionLabel[p] }))} />

        <ImageField label="Photo" value={photoUrl} onChange={setPhotoUrl} maxDim={480} />

        <Hint>
          Rating runs from {RATING_MIN.toFixed(1)} to {RATING_MAX.toFixed(1)}. It moves automatically after each match day with team results, goals, assists
          and clean sheets; set it here to override.
        </Hint>

        {initial ? (
          <View style={styles.stats}>
            <Label>Career stats (from finished Match Day games)</Label>
            <Figures
              items={[
                { label: "Apps", value: initial.appearances },
                { label: "Goals", value: initial.goals },
                { label: "Assists", value: initial.assists },
                { label: "Clean sheets", value: initial.cleanSheets },
              ]}
            />
          </View>
        ) : (
          <View style={styles.gap} />
        )}

        <FormError message={error} />
        <Button label={initial ? "Save changes" : "Add player"} onPress={submit} busy={busy} />
        {numberOwner ? <Hint tone={colors.loss}>Pick a number no one else wears.</Hint> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stats: { marginTop: 20 },
  gap: { height: 20 },
});
