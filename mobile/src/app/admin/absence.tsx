import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { absenceLabel, absencePeriod, absenceTypes, todayIso } from "../../lib/absences";
import type { AbsenceType } from "../../lib/types";
import { Choice, FormError, Hint, Section, ShirtPicker, TextField, confirm } from "../../components/form";
import { Button, Chips, Pill, Screen, Txt, text } from "../../components/ui";
import { space } from "../../theme";

// Log or edit one absence (`?id=` to edit). Dates are yyyy-mm-dd, with
// quick picks for the usual spells.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default function AbsenceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { players, absences, addAbsence, updateAbsence, removeAbsence } = useClub();
  const existing = id ? absences.find((a) => a.id === Number(id)) : undefined;

  const [playerId, setPlayerId] = useState(existing?.playerId ?? 0);
  const [type, setType] = useState<AbsenceType>(existing?.type ?? "injury");
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? todayIso());
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const squad = players.filter((p) => p.active || p.id === playerId);
  const t = absenceLabel(type);

  async function save() {
    if (!playerId) return setError("Pick the player who's out.");
    if (!ISO.test(startsOn)) return setError("Enter the start date as yyyy-mm-dd.");
    if (endsOn && !ISO.test(endsOn)) return setError("Enter the return date as yyyy-mm-dd, or leave it blank.");
    if (endsOn && endsOn < startsOn) return setError("The return date must be on or after the start date.");
    setBusy(true);
    setError("");
    const input = { playerId, type, reason, startsOn, endsOn: endsOn || null };
    try {
      if (existing) await updateAbsence(existing.id, input);
      else await addAbsence(input);
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that absence."));
      setBusy(false);
    }
  }

  function remove() {
    if (!existing) return;
    confirm("Remove this absence?", "It comes off the squad list and the Noisers blog.", "Remove", async () => {
      try {
        await removeAbsence(existing.id);
        router.back();
      } catch (err) {
        setError(errorMessage(err, "Couldn't remove that absence."));
      }
    });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Section title="Who's out">
          <ShirtPicker players={squad} value={playerId} onChange={setPlayerId} />
        </Section>

        <Section title="Why" description={t.blurb}>
          <Choice<AbsenceType> value={type} onChange={setType} options={absenceTypes.map((x) => ({ value: x.id, label: x.label, tone: x.tone }))} />
          <TextField label="Details (optional)" value={reason} onChangeText={setReason} placeholder={type === "injury" ? "Hamstring strain" : type === "travel" ? "Work trip to Abuja" : ""} />
        </Section>

        <Section title="When">
          <TextField label="Out from" value={startsOn} onChangeText={setStartsOn} placeholder="yyyy-mm-dd" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          <Chips
            value=""
            onChange={(v) => setStartsOn(v)}
            options={[
              { value: todayIso(), label: "Today" },
              { value: todayIso(1), label: "Tomorrow" },
              { value: todayIso(7), label: "Next week" },
            ]}
          />
          <TextField label="Back on" value={endsOn} onChangeText={setEndsOn} placeholder="yyyy-mm-dd, or blank" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          <Chips
            value=""
            onChange={(v) => setEndsOn(v === "none" ? "" : v)}
            options={[
              { value: "none", label: "No return date" },
              { value: todayIso(7), label: "1 week" },
              { value: todayIso(14), label: "2 weeks" },
              { value: todayIso(28), label: "4 weeks" },
            ]}
          />
          <Hint>{"Leave \"Back on\" blank while there's no return date."}</Hint>
        </Section>

        {ISO.test(startsOn) ? (
          <View style={styles.preview}>
            <Pill label={t.short} tone={t.tone} icon={t.icon} />
            <Txt style={text.dim}>{absencePeriod({ startsOn, endsOn: endsOn && ISO.test(endsOn) ? endsOn : null })}</Txt>
          </View>
        ) : null}

        <FormError message={error} />
        <Button label={existing ? "Save changes" : "Log absence"} icon="checkmark" busy={busy} onPress={save} />
        {existing ? (
          <View style={styles.gap}>
            <Button label="Remove" variant="danger" icon="trash-outline" onPress={remove} />
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg, paddingHorizontal: 4 },
  gap: { marginTop: space.md },
});
