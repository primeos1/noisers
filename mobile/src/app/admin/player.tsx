import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { positionLabel, positions, RATING_MAX, RATING_MIN } from "../../lib/derive";
import { nextJerseyNumber } from "../../lib/matchDay";
import { membershipLabels, type Membership, type Position } from "../../lib/types";
import { Choice, Col, FieldRow, FormError, Hint, ImageField, Label, NumberField, TextField } from "../../components/form";
import { Button, Figures, Screen } from "../../components/ui";
import { colors } from "../../theme";

/**
 * Add a player, or edit one (`?id=12`, the player id). `?present=<event id>`
 * also ticks the new player as present on that match day — used from Match Day.
 */
export default function PlayerFormScreen() {
  const params = useLocalSearchParams<{ id?: string; present?: string }>();
  const { players, events, settings, addPlayer, updatePlayer, updateEvent } = useClub();
  const initial = params.id ? players.find((p) => p.id === Number(params.id)) : undefined;

  const [number, setNumber] = useState(initial?.number ?? nextJerseyNumber(players));
  const [name, setName] = useState(initial?.name ?? "");
  const [membership, setMembership] = useState<Membership>(initial?.membership ?? "member");
  const [position, setPosition] = useState<Position>(initial?.position ?? "MID");
  const [secondaryPosition, setSecondaryPosition] = useState<Position | "">(initial?.secondaryPosition ?? "");
  const [rating, setRating] = useState(initial?.rating ?? settings.ratingNewPlayer);
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Shirt numbers are unique, so flag straight away if someone already wears it.
  const numberOwner = players.find((p) => p.number === number && p.id !== initial?.id);

  async function submit() {
    if (!name.trim()) return setError("Enter a player name.");
    if (!Number.isInteger(number) || number < 1 || number > 99) return setError("Jersey number must be a whole number from 1 to 99.");
    if (numberOwner) return setError(`Number ${number} is already taken by ${numberOwner.name}. Pick another number.`);
    if (Number.isNaN(rating) || rating < RATING_MIN || rating > RATING_MAX) return setError(`Rating must be between ${RATING_MIN} and ${RATING_MAX}.`);

    setBusy(true);
    setError("");
    try {
      const input = {
        number,
        name,
        position,
        secondaryPosition: secondaryPosition && secondaryPosition !== position ? secondaryPosition : null,
        membership,
        rating,
        photoUrl: photoUrl.trim() || null,
      };
      if (initial) {
        await updatePlayer(initial.id, input);
      } else {
        const created = await addPlayer(input);
        const event = params.present ? events.find((e) => e.id === params.present) : undefined;
        if (event) await updateEvent(event.id, { presentPlayers: [...event.presentPlayers, created.id] });
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

        <Label>Membership</Label>
        <Choice<Membership>
          value={membership}
          onChange={setMembership}
          options={(Object.keys(membershipLabels) as Membership[]).map((m) => ({ value: m, label: membershipLabels[m] }))}
        />

        <Label>Main position</Label>
        <Choice<Position>
          value={position}
          onChange={(next) => {
            setPosition(next);
            if (secondaryPosition === next) setSecondaryPosition("");
          }}
          options={positions.map((p) => ({ value: p, label: positionLabel[p] }))}
        />

        <Label>Second position (optional)</Label>
        <Choice<Position | "">
          value={secondaryPosition}
          onChange={setSecondaryPosition}
          options={[
            { value: "", label: "None" },
            ...positions.filter((p) => p !== position).map((p) => ({ value: p as Position | "", label: positionLabel[p] })),
          ]}
        />

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
        {numberOwner ? <Hint tone={colors.loss}>Number {number} is taken by {numberOwner.name}. Pick another number.</Hint> : null}
        <Button label={initial ? "Save changes" : "Add player"} onPress={submit} busy={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stats: { marginTop: 20 },
  gap: { height: 20 },
});
