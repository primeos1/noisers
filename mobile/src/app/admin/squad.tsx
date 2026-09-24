import { useState } from "react";
import { Pressable, Share, StyleSheet, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { plural, positionLabel } from "../../lib/derive";
import type { Player } from "../../lib/types";
import { confirm } from "../../components/form";
import { Avatar, Button, Empty, ErrorBanner, Group, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Same columns as the web's "Export CSV" (frontend/src/lib/clubData.ts).
function squadCsv(players: Player[]) {
  const header = ["Number", "Name", "Position", "Rating", "Appearances", "Goals", "Assists", "Clean sheets"];
  const rows = [...players]
    .sort((a, b) => a.number - b.number)
    .map((p) => [p.number, p.name, p.position, p.rating, p.appearances, p.goals, p.assists, p.cleanSheets].map(csvCell).join(","));
  return [header.join(","), ...rows].join("\n");
}

export default function SquadAdminScreen() {
  const { players, refresh, removePlayer } = useClub();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const q = query.trim().toLowerCase();
  const sorted = [...players]
    .sort((a, b) => a.number - b.number)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.number) === q);

  function confirmRemove(player: Player) {
    confirm("Remove player?", `Remove ${player.name} (#${player.number}) from the squad? This can't be undone.`, "Remove", async () => {
      setError("");
      try {
        await removePlayer(player.number);
      } catch (err) {
        setError(errorMessage(err, "Couldn't remove that player."));
      }
    });
  }

  return (
    <Screen onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/admin/player")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add player">
              <Ionicons name="add" size={26} color={colors.paper} />
            </Pressable>
          ),
        }}
      />

      <ErrorBanner message={error} />

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.mist} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or number"
          placeholderTextColor={colors.mist}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Search the squad"
        />
      </View>

      {sorted.length === 0 ? (
        <Empty>{players.length ? "No one matches that search." : "No players yet. Add the first one."}</Empty>
      ) : (
        <Group title={plural(players.length, "player")} aside="Tap to edit, long-press to remove">
          {sorted.map((p) => (
            <Row
              key={p.number}
              onPress={() => router.push({ pathname: "/admin/player", params: { number: String(p.number) } })}
              onLongPress={() => confirmRemove(p)}
              accessibilityLabel={`Edit ${p.name}`}
            >
              <Avatar player={p} size={44} />
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {p.name}
                  {p.active ? "" : "  (inactive)"}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  #{p.number} · {positionLabel[p.position]} · {p.rating.toFixed(2)}
                </Txt>
                <Txt style={[text.small, styles.stats]} numberOfLines={1}>
                  {p.appearances} apps · {p.goals} G · {p.assists} A · {p.cleanSheets} CS
                </Txt>
              </View>
            </Row>
          ))}
        </Group>
      )}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Add player" icon="person-add-outline" onPress={() => router.push("/admin/player")} />
        </View>
        <View style={styles.flex}>
          <Button
            label="Export CSV"
            variant="secondary"
            icon="share-outline"
            disabled={players.length === 0}
            onPress={() => Share.share({ title: "Noisers squad", message: squadCsv(players) })}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  stats: { color: colors.paperDim, marginTop: 1 },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.inkRaised, borderRadius: radius.pill, paddingHorizontal: space.lg, marginBottom: space.lg },
  searchInput: { flex: 1, minHeight: 44, color: colors.paper, fontFamily: fonts.body, fontSize: 15 },
  actions: { flexDirection: "row", gap: space.md },
});
