import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { errorMessage } from "../../lib/api";
import { resolveMediaUrl } from "../../lib/config";
import { EXECUTIVE_GROUPS, useExecutives } from "../../lib/content";
import type { Executive } from "../../lib/types";
import { Empty, ErrorBanner, Group, Loading, Row, Screen, Txt, text } from "../../components/ui";
import { Intro } from "../../components/form";
import { colors, fonts, glass } from "../../theme";

// Edit the Executives page (frontend/src/pages/admin/AdminExecutives.tsx):
// executives, staff and the disciplinary panel, each in the order shown.

export default function AdminExecutivesScreen() {
  const { executives, loading, error, reload, reorder } = useExecutives();
  const [saveError, setSaveError] = useState("");

  // Pick up adds and edits made in the form.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const sorted = [...executives].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  function move(exec: Executive, dir: -1 | 1) {
    const group = sorted.filter((e) => e.group === exec.group);
    const i = group.findIndex((e) => e.id === exec.id);
    const j = i + dir;
    if (j < 0 || j >= group.length) return;
    const swapped = [...group];
    [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
    // Rebuild the full order with this group's new sequence in its slots.
    let k = 0;
    const ids = sorted.map((e) => (e.group === exec.group ? swapped[k++].id : e.id));
    setSaveError("");
    reorder(ids).catch((err) => setSaveError(errorMessage(err, "Couldn't save the new order.")));
  }

  return (
    <Screen onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/admin/executive")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add someone">
              <Ionicons name="add" size={26} color={colors.paper} />
            </Pressable>
          ),
        }}
      />
      <Intro>Everyone on the public Executives page. Use the arrows to set the order they appear in.</Intro>
      <ErrorBanner message={error || saveError} onRetry={error ? reload : undefined} />

      {loading && executives.length === 0 ? (
        <Loading label="Loading…" />
      ) : executives.length === 0 ? (
        <Empty icon="people-outline">No one added yet. Tap + to add the president first.</Empty>
      ) : (
        EXECUTIVE_GROUPS.map((g) => {
          const people = sorted.filter((e) => e.group === g.id);
          if (people.length === 0) return null;
          return (
            <Group key={g.id} title={g.label} aside={people.length}>
              {people.map((e, i) => {
                const uri = resolveMediaUrl(e.photo);
                return (
                  <Row key={e.id} onPress={() => router.push({ pathname: "/admin/executive", params: { id: String(e.id) } })} chevron={false} accessibilityLabel={`${e.name}, ${e.title}. Edit`}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                    ) : (
                      <View style={[styles.photo, styles.initials]}>
                        <Txt style={styles.initialsText}>{e.name.slice(0, 1).toUpperCase()}</Txt>
                      </View>
                    )}
                    <View style={styles.flex}>
                      <Txt style={text.semi} numberOfLines={1}>
                        {e.name}
                      </Txt>
                      <Txt style={text.small} numberOfLines={1}>
                        {e.title}
                      </Txt>
                    </View>
                    <Pressable onPress={() => move(e, -1)} disabled={i === 0} hitSlop={6} style={[styles.arrow, i === 0 ? styles.off : null]} accessibilityRole="button" accessibilityLabel={`Move ${e.name} up`}>
                      <Ionicons name="chevron-up" size={18} color={colors.paper} />
                    </Pressable>
                    <Pressable onPress={() => move(e, 1)} disabled={i === people.length - 1} hitSlop={6} style={[styles.arrow, i === people.length - 1 ? styles.off : null]} accessibilityRole="button" accessibilityLabel={`Move ${e.name} down`}>
                      <Ionicons name="chevron-down" size={18} color={colors.paper} />
                    </Pressable>
                  </Row>
                );
              })}
            </Group>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  photo: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.inkLine },
  initials: { alignItems: "center", justifyContent: "center" },
  initialsText: { fontFamily: fonts.display, fontSize: 20, color: colors.paperDim },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: glass.raised },
  off: { opacity: 0.3 },
});

