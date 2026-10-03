import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { cardCounts, eventGoals, plural, positionLabel, positions, recentActivity, sortEvents } from "../../lib/derive";
import type { Player, Position } from "../../lib/types";
import {
  Avatar,
  Bar,
  CardPips,
  Empty,
  ErrorBanner,
  Figures,
  Group,
  PageTitle,
  RefCard,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Txt,
  text,
} from "../../components/ui";
import { colors, fonts, foil, glass, radius, space } from "../../theme";

type View_ = "overview" | "leaders" | "positions" | "activity";

const positionColor: Record<Position, string> = { GK: colors.draw, DEF: colors.win, MID: colors.paperDim, FWD: colors.loss };

function Leaderboard({
  title,
  rows,
  tone,
  format = String,
}: {
  title: string;
  rows: { player: Player; value: number }[];
  tone: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <Group title={title}>
      {rows.length === 0 ? (
        <Row>
          <Txt style={text.small}>Nothing recorded yet.</Txt>
        </Row>
      ) : (
        rows.map(({ player, value }, i) => (
          <Row key={player.id} onPress={() => router.push(`/player/${player.id}`)}>
            <Txt style={[styles.rank, i === 0 ? null : styles.rankDim]}>{i + 1}</Txt>
            <Avatar player={player} size={36} ring={i === 0 ? colors.gold : undefined} />
            <View style={styles.flex}>
              <View style={styles.leaderLine}>
                <Txt style={[text.semi, styles.shrink]} numberOfLines={1}>
                  {player.name}
                </Txt>
                <Txt style={styles.leaderValue}>{format(value)}</Txt>
              </View>
              <View style={styles.barGap}>
                <Bar value={value} max={max} tone={tone} />
              </View>
            </View>
          </Row>
        ))
      )}
    </Group>
  );
}

const PODIUM = [
  { place: 2, height: 92, colors: ["#e6eaf2", "#8a93a6"] as const },
  { place: 1, height: 128, colors: [foil[0], foil[2]] as const },
  { place: 3, height: 70, colors: ["#e7a77a", "#7a4524"] as const },
];

/** Top three on blocks that rise up in 3D, gold in the middle. */
function Podium({ rows, unit }: { rows: { player: Player; value: number }[]; unit: string }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.podium} accessibilityRole="summary" accessibilityLabel={rows.map((r, i) => `${i + 1}. ${r.player.name}, ${r.value} ${unit}`).join(". ")}>
      {PODIUM.map((step) => {
        const row = rows[step.place - 1];
        return row ? <PodiumStep key={step.place} row={row} step={step} /> : <View key={step.place} style={styles.flex} />;
      })}
    </View>
  );
}

function PodiumStep({ row, step }: { row: { player: Player; value: number }; step: (typeof PODIUM)[number] }) {
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(withDelay((3 - step.place) * 140, withSpring(1, { damping: 13, stiffness: 90 })));
  }, [rise, step.place]);
  const block = useAnimatedStyle(() => ({ height: step.height * rise.value }));
  const head = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 30 }] }));
  const gold = step.place === 1;
  return (
    <Pressable style={styles.step} onPress={() => router.push(`/player/${row.player.id}`)} accessibilityElementsHidden>
      <Animated.View style={[styles.stepHead, head]}>
        {gold ? <Ionicons name="trophy" size={18} color={colors.goldBright} /> : null}
        <Avatar player={row.player} size={gold ? 64 : 52} ring={step.colors[0]} />
        <Txt style={[text.semi, styles.stepName]} numberOfLines={1}>
          {row.player.name.split(" ")[0]}
        </Txt>
        <Txt style={[styles.stepValue, gold ? { color: colors.goldBright } : null]}>{row.value}</Txt>
      </Animated.View>
      <View style={styles.stepBase}>
        <Animated.View style={[styles.blockWrap, block]}>
          <LinearGradient colors={step.colors} style={styles.blockLid} />
          <LinearGradient colors={[`${step.colors[1]}cc`, "rgba(10,14,26,0.9)"]} style={styles.block}>
            <Txt style={styles.place}>{step.place}</Txt>
          </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}

export default function StatsScreen() {
  const { players, events, cards, error, refresh } = useClub();
  const [view, setView] = useState<View_>("overview");

  const goals = players.reduce((s, p) => s + p.goals, 0);
  const assists = players.reduce((s, p) => s + p.assists, 0);
  const avg = players.length ? players.reduce((s, p) => s + p.rating, 0) / players.length : 0;

  const top = (key: "goals" | "assists" | "cleanSheets" | "saves" | "rating") =>
    players
      // Clean sheets only count for the back line: keepers and defenders.
      .filter((p) => key !== "cleanSheets" || [p.position, p.secondaryPosition].some((pos) => pos === "GK" || pos === "DEF"))
      .map((p) => ({ player: p, value: p[key] ?? 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

  const rankings = [
    { title: "Top scorers", key: "goals", unit: "goals" },
    { title: "Top assists", key: "assists", unit: "assists" },
    { title: "Most saves", key: "saves", unit: "saves" },
    { title: "Most clean sheets", key: "cleanSheets", unit: "clean sheets" },
  ] as const;

  const booked = players
    .map((p) => ({ player: p, c: cardCounts(cards, p.id) }))
    .filter(({ c }) => c.yellow + c.red > 0)
    .sort((a, b) => b.c.red * 2 + b.c.yellow - (a.c.red * 2 + a.c.yellow))
    .slice(0, 5);

  const byPosition = positions.map((pos) => {
    const group = players.filter((p) => p.position === pos);
    return {
      pos,
      count: group.length,
      goals: group.reduce((s, p) => s + p.goals, 0),
      assists: group.reduce((s, p) => s + p.assists, 0),
      cleanSheets: group.reduce((s, p) => s + p.cleanSheets, 0),
      saves: group.reduce((s, p) => s + (p.saves ?? 0), 0),
      avg: group.length ? group.reduce((s, p) => s + p.rating, 0) / group.length : 0,
    };
  });

  const recentDays = sortEvents(events).slice(0, 8);
  const maxDayGoals = Math.max(...recentDays.map(eventGoals), 0);
  const activity = recentActivity(events, players);

  return (
    <Screen onRefresh={refresh} topInset>
      <PageTitle eyebrow="Every number from match days" title="Stats" />
      <ErrorBanner message={error} onRetry={refresh} />

      <Segmented<View_>
        value={view}
        onChange={setView}
        options={[
          { value: "overview", label: "Overview" },
          { value: "leaders", label: "Leaders" },
          { value: "positions", label: "Positions" },
          { value: "activity", label: "Activity" },
        ]}
      />

      {view === "overview" ? (
        <>
          {rankings.map((r) => {
            const rows = top(r.key).slice(0, 3);
            return rows.length ? (
              <View key={r.key}>
                <SectionHeader title={r.title} action="See all" onAction={() => setView("leaders")} />
                <Podium rows={rows} unit={r.unit} />
              </View>
            ) : null;
          })}
          <Figures
            items={[
              { label: "Goals", value: goals, tone: colors.win },
              { label: "Assists", value: assists },
              { label: "Avg rating", value: avg.toFixed(2), tone: colors.draw },
            ]}
          />

          <Group title="Squad by position" aside={plural(players.length, "player")}>
            <View style={styles.positionsCard}>
              <View style={styles.stacked}>
                {byPosition
                  .filter((b) => b.count > 0)
                  .map((b) => (
                    <View key={b.pos} style={{ flexGrow: b.count, backgroundColor: positionColor[b.pos] }} />
                  ))}
              </View>
              <View style={styles.legend}>
                {byPosition.map((b) => (
                  <View key={b.pos} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: positionColor[b.pos] }]} />
                    <Txt style={[text.dim, styles.flex]}>{positionLabel[b.pos]}</Txt>
                    <Txt style={text.semi}>{b.count}</Txt>
                  </View>
                ))}
              </View>
            </View>
          </Group>

          <Group title="Goals per match day">
            {recentDays.length === 0 ? (
              <Row>
                <Txt style={text.small}>No match days yet.</Txt>
              </Row>
            ) : (
              recentDays.map((e) => (
                <Row key={e.id} onPress={() => router.push(`/match/${e.id}`)}>
                  <View style={styles.flex}>
                    <View style={styles.leaderLine}>
                      <Txt style={[text.body, styles.shrink]} numberOfLines={1}>
                        {e.title}
                      </Txt>
                      <Txt style={[styles.leaderValue, { color: colors.win }]}>{eventGoals(e)}</Txt>
                    </View>
                    <View style={styles.barGap}>
                      <Bar value={eventGoals(e)} max={maxDayGoals} tone={colors.win} />
                    </View>
                  </View>
                </Row>
              ))
            )}
          </Group>
        </>
      ) : null}

      {view === "leaders" ? (
        <>
          <Leaderboard title="Most goals" rows={top("goals")} tone={colors.win} />
          <Leaderboard title="Most assists" rows={top("assists")} tone={colors.paper} />
          <Leaderboard title="Most saves" rows={top("saves")} tone={colors.travel} />
          <Leaderboard title="Most clean sheets" rows={top("cleanSheets")} tone={colors.win} />
          <Leaderboard title="Highest rated" rows={top("rating")} tone={colors.draw} format={(v) => v.toFixed(2)} />
          <Group title="Most booked">
            {booked.length === 0 ? (
              <Row>
                <Txt style={text.small}>No cards shown yet.</Txt>
              </Row>
            ) : (
              booked.map(({ player, c }) => (
                <Row key={player.id} onPress={() => router.push(`/player/${player.id}`)}>
                  <Avatar player={player} size={36} />
                  <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                    {player.name}
                  </Txt>
                  <CardPips yellow={c.yellow} red={c.red} />
                  {c.outstanding > 0 ? <Txt style={[text.small, { color: colors.loss }]}>owes</Txt> : null}
                </Row>
              ))
            )}
          </Group>
        </>
      ) : null}

      {view === "positions"
        ? byPosition.map((b) => (
            <Group key={b.pos} title={positionLabel[b.pos]} aside={plural(b.count, "player")}>
              <View style={styles.posStats}>
                {[
                  { l: "Goals", v: b.goals, t: colors.win },
                  { l: "Assists", v: b.assists, t: colors.paper },
                  // Forwards don't keep clean sheets.
                  ...(b.pos === "FWD" ? [] : [{ l: "Clean sheets", v: b.cleanSheets, t: colors.paper }]),
                  ...(b.pos === "GK" ? [{ l: "Saves", v: b.saves, t: colors.paper }] : []),
                  { l: "Avg rating", v: b.count ? b.avg.toFixed(2) : "–", t: colors.draw },
                ].map((s) => (
                  <View key={s.l} style={styles.posStat}>
                    <Txt style={[styles.posValue, { color: s.t }]}>{s.v}</Txt>
                    <Txt style={[text.small, styles.center]}>{s.l}</Txt>
                  </View>
                ))}
              </View>
            </Group>
          ))
        : null}

      {view === "activity" ? (
        activity.length === 0 ? (
          <Empty>No goals or cards logged yet. They'll appear here as match days are played.</Empty>
        ) : (
          <Group title="Latest goals and cards">
            {activity.map((a) => (
              <Row key={a.key} onPress={() => router.push(`/match/${a.event.id}`)}>
                <Txt style={styles.minute}>{a.minute}'</Txt>
                {a.kind === "goal" || a.kind === "own-goal" ? (
                  <Ionicons name="football" size={16} color={a.kind === "own-goal" ? colors.loss : colors.win} />
                ) : (
                  <RefCard type={a.kind} size="md" />
                )}
                <View style={styles.flex}>
                  <Txt style={text.body} numberOfLines={1}>
                    {a.text}
                  </Txt>
                  <Txt style={text.small} numberOfLines={1}>
                    {a.event.title}, {a.detail}
                  </Txt>
                </View>
              </Row>
            ))}
          </Group>
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  center: { textAlign: "center" },
  rank: { width: 20, textAlign: "center", fontFamily: fonts.display, fontSize: 18, color: colors.paper },
  rankDim: { color: colors.mist },
  leaderLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  leaderValue: { fontFamily: fonts.display, fontSize: 22, color: colors.paper, fontVariant: ["tabular-nums"] },
  barGap: { marginTop: 6 },
  positionsCard: { padding: space.lg },
  stacked: { flexDirection: "row", height: 12, gap: 2, borderRadius: 6, overflow: "hidden" },
  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: space.md, rowGap: 6 },
  legendItem: { width: "50%", flexDirection: "row", alignItems: "center", gap: 8, paddingRight: space.lg },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  posStats: { flexDirection: "row", paddingVertical: space.lg, paddingHorizontal: space.sm },
  posStat: { flex: 1, alignItems: "center", paddingHorizontal: 2 },
  posValue: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, marginBottom: 6, fontVariant: ["tabular-nums"] },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginBottom: space.xl, paddingTop: space.md },
  step: { flex: 1, alignItems: "center" },
  stepHead: { alignItems: "center", gap: 4, marginBottom: space.sm },
  stepName: { fontSize: 13, maxWidth: "100%" },
  stepValue: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 28, color: colors.paper },
  stepBase: { alignSelf: "stretch", height: 128, justifyContent: "flex-end", transform: [{ perspective: 600 }, { rotateX: "8deg" }] },
  blockWrap: { overflow: "hidden", borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  blockLid: { height: 10, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  block: { flex: 1, alignItems: "center", paddingTop: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, borderTopWidth: 0 },
  place: { fontFamily: fonts.displayHeavy, fontSize: 30, color: "rgba(246,246,243,0.75)" },
  minute: { width: 34, textAlign: "center", fontFamily: fonts.display, fontSize: 18, color: colors.mist, fontVariant: ["tabular-nums"] },
});
