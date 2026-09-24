import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useClub } from "../../lib/club";
import { plural, scoreOf, sortEvents } from "../../lib/derive";
import { confirmRemoveEvent } from "../../components/form";
import { Empty, ErrorBanner, Group, LiveTag, PageTitle, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

export default function MatchesAdminScreen() {
  const { events, refresh, removeEvent } = useClub();
  const [error, setError] = useState("");
  const sorted = sortEvents(events);

  return (
    <Screen onRefresh={refresh}>
      <PageTitle
        title="Matches"
        sub="Every match day, with every game played. Tap one for the full match sheet; long-press to delete it."
      />
      <ErrorBanner message={error} />

      {sorted.length === 0 ? (
        <Empty>No match days recorded yet. Start one from Match Day.</Empty>
      ) : (
        <Group title={plural(sorted.length, "match day")}>
          {sorted.map((event) => (
            <Row
              key={event.id}
              onPress={() => router.push(`/match/${event.id}`)}
              onLongPress={() => confirmRemoveEvent(event, removeEvent, setError)}
              accessibilityLabel={`${event.title}, ${plural(event.games.length, "game")}`}
            >
              <View style={styles.flex}>
                <View style={styles.titleLine}>
                  <Txt style={styles.title} numberOfLines={1}>
                    {event.title}
                  </Txt>
                  {event.status === "live" ? <LiveTag /> : null}
                </View>
                <Txt style={text.small} numberOfLines={1}>
                  {[event.venue, event.date, plural(event.games.length, "game")].filter(Boolean).join(" · ")}
                </Txt>
                {event.games.length ? (
                  <View style={styles.chips}>
                    {event.games.map((g) => (
                      <View key={g.id} style={styles.chip}>
                        <Txt style={styles.chipText}>
                          {scoreOf(g, 0)}–{scoreOf(g, 1)}
                        </Txt>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Row>
          ))}
        </Group>
      )}

      {sorted.some((e) => e.status === "live") ? (
        <Pressable onPress={() => router.push("/admin/matchday")} accessibilityRole="button">
          <Txt style={[text.small, styles.link]}>A match day is live. Open Match Day to run it →</Txt>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.paper, flexShrink: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  chip: { backgroundColor: colors.inkLine, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.paper, fontVariant: ["tabular-nums"] },
  link: { textAlign: "center", color: colors.paper },
});
