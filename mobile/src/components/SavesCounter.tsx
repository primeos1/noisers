import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { MatchDayGame, MatchDaySave, Player } from "../lib/types";
import { isKeeper } from "../lib/derive";
import { Txt, text } from "./ui";
import { colors, fonts, radius, space } from "../theme";

// The phone version of frontend/src/components/admin/SavesCounter.tsx: tap
// counters for each keeper on both sides — saves, and penalties saved (which
// count as saves too). Squad players with GK as their main or second position
// are listed; a side without one picks whoever went in goal. "+" adds at
// `minute`; "−" takes back that player's latest of that kind.

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
  /** Gets a change to make to the game's latest saves, so it can be re-applied. */
  onChange: (update: (saves: MatchDaySave[]) => MatchDaySave[]) => void;
}) {
  const saves = game.saves ?? [];
  // Who went in goal for a side with no keeper, picked on this screen.
  const [standIns, setStandIns] = useState<[number | null, number | null]>([null, null]);

  function add(teamIndex: 0 | 1, playerId: number, penalty: boolean) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const save: MatchDaySave = { id: newSaveId(), teamIndex, playerId, minute, ...(penalty ? { penalty: true } : {}) };
    onChange((latest) => [...latest, save]);
  }

  function undo(playerId: number, penalty: boolean) {
    for (let i = saves.length - 1; i >= 0; i--) {
      const last = saves[i];
      if (last.playerId === playerId && !!last.penalty === penalty) return onChange((latest) => latest.filter((s) => s.id !== last.id));
    }
  }

  const squadPlayer = (id: unknown) => (typeof id === "number" ? players.find((p) => p.id === id) : undefined);

  return (
    <View style={styles.sides}>
      {([0, 1] as const).map((t) => {
        const onSide = game.teams[t].players.map(squadPlayer).filter((p): p is Player => !!p);
        const hasKeeper = onSide.some(isKeeper);
        // Keepers on the side now, anyone (subbed off or a stand-in) who already
        // made saves for it, and the stand-in picked here while still on the side.
        const ids = new Set<number>([
          ...onSide.filter(isKeeper).map((p) => p.id),
          ...saves.filter((s) => s.teamIndex === t && typeof s.playerId === "number").map((s) => s.playerId as number),
          ...onSide.filter((p) => p.id === standIns[t]).map((p) => p.id),
        ]);
        const goalies = [...ids].map(squadPlayer).filter((p): p is Player => !!p);
        const candidates = onSide.filter((p) => !ids.has(p.id));

        return (
          <View key={t}>
            <Txt style={styles.side}>{game.teams[t].name}</Txt>
            {goalies.length === 0 ? <Txt style={text.small}>No keeper on this side.</Txt> : null}
            {goalies.map((goalie) => (
              <View key={goalie.id} style={styles.card}>
                <Txt style={styles.name} numberOfLines={1}>
                  {goalie.name}
                  {!isKeeper(goalie) ? <Txt style={text.small}>  in goal</Txt> : null}
                </Txt>
                <View style={styles.counters}>
                  {([false, true] as const).map((penalty) => {
                    const count = saves.filter((s) => s.playerId === goalie.id && !!s.penalty === penalty).length;
                    const kind = penalty ? "penalty save" : "save";
                    return (
                      <View key={String(penalty)} style={styles.counter}>
                        <Txt style={styles.label}>{penalty ? "Penalties" : "Saves"}</Txt>
                        <Pressable
                          onPress={() => undo(goalie.id, penalty)}
                          disabled={count === 0}
                          accessibilityRole="button"
                          accessibilityLabel={`Take back a ${kind} by ${goalie.name}`}
                          style={[styles.button, styles.minus, count === 0 && styles.disabled]}
                        >
                          <Txt style={styles.minusLabel}>−</Txt>
                        </Pressable>
                        <Txt style={styles.count} accessibilityLiveRegion="polite">
                          {count}
                        </Txt>
                        <Pressable
                          onPress={() => add(t, goalie.id, penalty)}
                          accessibilityRole="button"
                          accessibilityLabel={`Add a ${kind} by ${goalie.name}`}
                          style={[styles.button, styles.plus]}
                        >
                          <Txt style={styles.plusLabel}>+</Txt>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
            {!hasKeeper && candidates.length > 0 ? (
              <View style={styles.pick}>
                <Txt style={text.small}>{goalies.length ? "Someone else in goal?" : "Who's in goal?"}</Txt>
                <View style={styles.pills}>
                  {candidates.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setStandIns((s) => (t === 0 ? [p.id, s[1]] : [s[0], p.id]))}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name} is in goal`}
                      style={styles.pill}
                    >
                      <Txt style={styles.pillText} numberOfLines={1}>
                        {p.name}
                      </Txt>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sides: { gap: space.lg },
  side: { fontFamily: fonts.bodySemi, fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: colors.mist, marginBottom: space.sm },
  card: { backgroundColor: colors.ink, borderRadius: radius.sm, padding: space.sm, paddingLeft: space.md, marginBottom: space.sm, gap: space.sm },
  name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.paper },
  counters: { flexDirection: "row", gap: space.md },
  counter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  label: { flex: 1, minWidth: 0, fontSize: 12, color: colors.mist },
  button: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  minus: { borderWidth: 1, borderColor: colors.inkLine },
  plus: { backgroundColor: colors.paper },
  disabled: { opacity: 0.4 },
  minusLabel: { fontFamily: fonts.bodySemi, fontSize: 20, color: colors.paperDim },
  plusLabel: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink },
  count: { width: 26, textAlign: "center", fontFamily: fonts.display, fontSize: 24, color: colors.paper, fontVariant: ["tabular-nums"] },
  pick: { gap: space.sm, marginTop: space.xs },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pill: { borderWidth: 1, borderColor: colors.inkLine, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.paperDim },
});
