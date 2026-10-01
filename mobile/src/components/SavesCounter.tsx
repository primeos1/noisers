import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { MatchDayGame, MatchDaySave, Player } from "../lib/types";
import { isKeeper } from "../lib/derive";
import { Txt, text } from "./ui";
import { colors, fonts, radius, space } from "../theme";

// The phone version of frontend/src/components/admin/SavesCounter.tsx: a
// tap counter per keeper on each side. Only squad players with GK as their
// main or second position are listed. "+" adds a save at `minute`; "−"
// takes back that keeper's latest one.

let idCounter = 0;
function newSaveId() {
  idCounter += 1;
  return `s${Date.now()}${idCounter}`;
}

export default function SavesCounter({
  game,
  players,
  minute,
  onChange,
}: {
  game: MatchDayGame;
  players: Player[];
  minute: number;
  onChange: (saves: MatchDaySave[]) => void;
}) {
  const saves = game.saves ?? [];

  function add(teamIndex: 0 | 1, playerId: number) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onChange([...saves, { id: newSaveId(), teamIndex, playerId, minute }]);
  }

  function undo(playerId: number) {
    for (let i = saves.length - 1; i >= 0; i--) {
      if (saves[i].playerId === playerId) return onChange(saves.filter((_, j) => j !== i));
    }
  }

  return (
    <View style={styles.sides}>
      {([0, 1] as const).map((t) => {
        // Keepers on the side now, plus any subbed off who already made saves.
        const ids = new Set([...game.teams[t].players, ...saves.filter((s) => s.teamIndex === t).map((s) => s.playerId)]);
        const keepers = [...ids]
          .map((id) => (typeof id === "number" ? players.find((p) => p.id === id) : undefined))
          .filter((p): p is Player => !!p && isKeeper(p));
        return (
          <View key={t}>
            <Txt style={styles.side}>{game.teams[t].name}</Txt>
            {keepers.length === 0 ? (
              <Txt style={text.small}>No keeper on this side.</Txt>
            ) : (
              keepers.map((keeper) => {
                const count = saves.filter((s) => s.playerId === keeper.id).length;
                return (
                  <View key={keeper.id} style={styles.row}>
                    <Txt style={styles.name} numberOfLines={1}>
                      {keeper.name}
                    </Txt>
                    <Pressable
                      onPress={() => undo(keeper.id)}
                      disabled={count === 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Take back a save by ${keeper.name}`}
                      style={[styles.button, styles.minus, count === 0 && styles.disabled]}
                    >
                      <Txt style={styles.minusLabel}>−</Txt>
                    </Pressable>
                    <Txt style={styles.count} accessibilityLiveRegion="polite">
                      {count}
                    </Txt>
                    <Pressable
                      onPress={() => add(t, keeper.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add a save by ${keeper.name}`}
                      style={[styles.button, styles.plus]}
                    >
                      <Txt style={styles.plusLabel}>+</Txt>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sides: { gap: space.lg },
  side: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.mist, marginBottom: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    paddingLeft: space.md,
    paddingRight: space.sm,
    marginBottom: space.sm,
  },
  name: { flex: 1, minWidth: 0, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.paper },
  button: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  minus: { borderWidth: 1, borderColor: colors.inkLine },
  plus: { backgroundColor: colors.paper },
  disabled: { opacity: 0.4 },
  minusLabel: { fontFamily: fonts.bodySemi, fontSize: 20, color: colors.paperDim },
  plusLabel: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink },
  count: { width: 32, textAlign: "center", fontFamily: fonts.display, fontSize: 26, color: colors.paper, fontVariant: ["tabular-nums"] },
});
