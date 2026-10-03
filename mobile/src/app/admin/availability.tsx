import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { absenceLabel, absencePeriod, absenceTypes, returnHint } from "../../lib/absences";
import type { Absence, AbsenceStatus } from "../../lib/types";
import { confirm } from "../../components/form";
import { Avatar, Empty, ErrorBanner, Figures, Group, Pill, Row, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors } from "../../theme";

// Who's injured, travelling, suspended or otherwise out — the phone version
// of frontend/src/pages/admin/AdminAvailability.tsx. Absences show on the
// squad, player profiles and in the Noisers blog.

export default function AvailabilityScreen() {
  const { absences, players, refresh, removeAbsence } = useClub();
  const [filter, setFilter] = useState<AbsenceStatus>("active");
  const [error, setError] = useState("");

  const visible = absences
    .filter((a) => a.status === filter)
    .sort((a, b) => (filter === "ended" ? b.startsOn.localeCompare(a.startsOn) : a.startsOn.localeCompare(b.startsOn)));
  const count = (s: AbsenceStatus) => absences.filter((a) => a.status === s).length;
  const nameOf = (a: Absence) => players.find((p) => p.id === a.playerId)?.name ?? "Former player";

  function remove(a: Absence) {
    confirm("Remove this absence?", `${nameOf(a)} — ${absenceLabel(a.type).label.toLowerCase()}, ${absencePeriod(a)}.`, "Remove", () => {
      setError("");
      removeAbsence(a.id).catch((err) => setError(errorMessage(err, "Couldn't remove that absence.")));
    });
  }

  return (
    <Screen onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/admin/absence")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Log an absence">
              <Ionicons name="add" size={26} color={colors.paper} />
            </Pressable>
          ),
        }}
      />
      <Figures
        items={absenceTypes.map((t) => ({
          label: t.short,
          value: absences.filter((a) => a.status === "active" && a.type === t.id).length,
          tone: t.tone,
        }))}
      />
      <ErrorBanner message={error} />
      <Segmented<AbsenceStatus>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "active", label: `Out now (${count("active")})` },
          { value: "upcoming", label: `Upcoming (${count("upcoming")})` },
          { value: "ended", label: "Back" },
        ]}
      />

      {visible.length === 0 ? (
        <Empty icon="checkmark-circle-outline">
          {filter === "active" ? "Everyone's available. Tap + to log an injury, trip or suspension." : filter === "upcoming" ? "Nothing coming up." : "No past absences yet."}
        </Empty>
      ) : (
        <Group>
          {visible.map((a) => {
            const p = players.find((x) => x.id === a.playerId);
            const t = absenceLabel(a.type);
            return (
              <Row key={a.id} onPress={() => router.push({ pathname: "/admin/absence", params: { id: String(a.id) } })} onLongPress={() => remove(a)} accessibilityLabel={`${nameOf(a)}, ${t.short}, ${absencePeriod(a)}. Long press to remove.`}>
                {p ? <Avatar player={p} size={40} ring={t.tone} /> : null}
                <View style={styles.flex}>
                  <Txt style={text.semi} numberOfLines={1}>
                    {nameOf(a)}
                  </Txt>
                  <Txt style={text.small} numberOfLines={1}>
                    {[a.reason, absencePeriod(a)].filter(Boolean).join(" · ")}
                  </Txt>
                  {a.status !== "ended" ? <Txt style={[text.small, { color: t.tone }]}>{returnHint(a)}</Txt> : null}
                </View>
                <Pill label={t.short} tone={t.tone} icon={t.icon} />
              </Row>
            );
          })}
        </Group>
      )}
      <Txt style={[text.small, styles.tip]}>Tap to edit · long press to remove</Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tip: { textAlign: "center", marginTop: -8 },
});
