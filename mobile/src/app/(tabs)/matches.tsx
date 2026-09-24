import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useClub } from "../../lib/club";
import { eventGoals, eventParticipants, plural, scoreOf, sortEvents } from "../../lib/derive";
import { Empty, ErrorBanner, Group, LiveTag, Loading, PageTitle, Row, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors, fonts, space } from "../../theme";

type Filter = "all" | "ended" | "live";

export default function MatchesScreen() {
  const { events, loading, error, refresh } = useClub();
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = sortEvents(events);
  const visible = sorted.filter((e) => filter === "all" || e.status === filter);
  const live = sorted.filter((e) => e.status === "live").length;

  return (
    <Screen onRefresh={refresh} topInset>
      <PageTitle title="Match history" sub={`${plural(sorted.length, "match day")} so far`} />
      <ErrorBanner message={error} onRetry={refresh} />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "ended", label: "Results" },
          { value: "live", label: live ? `Live (${live})` : "Live" },
        ]}
      />

      {loading && events.length === 0 ? (
        <Loading label="Loading match days…" />
      ) : visible.length === 0 ? (
        <Empty>
          {filter === "live"
            ? "Nothing is being played right now."
            : "No match days yet. They'll show up here once the committee starts one."}
        </Empty>
      ) : (
        <Group>
          {visible.map((event) => (
            <Row key={event.id} onPress={() => router.push(`/match/${event.id}`)} style={styles.row}>
              <View style={styles.flex}>
                <View style={styles.titleLine}>
                  <Txt style={[text.display, styles.title]} numberOfLines={1}>
                    {event.title}
                  </Txt>
                  {event.status === "live" ? <LiveTag /> : null}
                </View>
                <Txt style={text.small}>{[event.date, event.venue].filter(Boolean).join(", ")}</Txt>
                {event.games.length > 0 ? (
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
                <Txt style={[text.small, styles.summary]}>
                  {plural(event.games.length, "game")}, {plural(eventGoals(event), "goal")}, {plural(eventParticipants(event), "player")}
                </Txt>
              </View>
            </Row>
          ))}
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { alignItems: "flex-start", paddingVertical: space.lg },
  titleLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  title: { fontSize: 24, flexShrink: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.paperDim, fontVariant: ["tabular-nums"] },
  summary: { marginTop: 10 },
});
