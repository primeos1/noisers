import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { formatNaira } from "../../lib/derive";
import type { CardType } from "../../lib/types";
import { Button, RefCard, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

export default function NewCardScreen() {
  const { players, settings, addCard } = useClub();
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

  const defaultFine = type === "red" ? settings.redCardFine : settings.yellowCardFine;
  const fineText = fineOverride ?? String(defaultFine);
  const fine = Number(fineText.replace(/[^0-9.]/g, ""));
  const selected = squad.find((p) => p.id === playerId);

  async function submit() {
    if (playerId === null) {
      setError("Pick the player who was booked.");
      return;
    }
    if (!Number.isFinite(fine) || fine < 0) {
      setError("Enter a fine of ₦0 or more.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await addCard({ playerId, type, reason: reason.trim(), fineAmount: fine, paid });
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't log that card."));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt style={styles.label}>Player</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shirts} keyboardShouldPersistTaps="handled">
        {squad.map((p) => {
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
      <Txt style={[text.dim, styles.selected]}>{selected ? selected.name : "Tap a shirt number"}</Txt>

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

      <View style={styles.preview}>
        <RefCard type={type} size="md" />
        <Txt style={[text.dim, styles.flex]}>
          {selected ? `${selected.name}, ${type} card` : `${type === "red" ? "Red" : "Yellow"} card`}
        </Txt>
        <Txt style={text.semi}>{Number.isFinite(fine) ? formatNaira(fine) : "–"}</Txt>
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
