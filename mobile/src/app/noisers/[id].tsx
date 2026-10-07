import { Pressable, Share, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { cachedStory, KIND_ACCENT, readingTime, timeAgo, useNoisers } from "../../lib/content";
import { absenceLabel, absencePeriod } from "../../lib/absences";
import { SITE_URL } from "../../lib/config";
import type { Player } from "../../lib/types";
import { Avatar, Empty, Figures, Group, Loading, RefCard, Row, Screen, Txt, text } from "../../components/ui";
import { Glass, Reveal } from "../../components/depth";
import { colors, fonts, glass, radius, space } from "../../theme";

// One Noisers story, laid out like the web's story page: headline and
// standfirst over the desk's colour, then the scoreline, numbers, lineup,
// cards or absence the story is about, and the article itself.

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players } = useClub();
  const { stories, loading } = useNoisers();
  const story = cachedStory(id) ?? stories.find((s) => s.id === id);

  if (!story) {
    return <Screen topInset="header">{loading ? <Loading label="Loading the story…" /> : <Empty icon="newspaper-outline">{"This story isn't in the feed any more."}</Empty>}</Screen>;
  }

  const accent = KIND_ACCENT[story.kind];
  const find = (pid: number | null) => (pid == null ? undefined : players.find((p) => p.id === pid));
  const featured = story.playerIds.map(find).filter((p): p is Player => !!p);
  const lineup = (story.lineup?.playerIds ?? []).map(find).filter((p): p is Player => !!p);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => Share.share({ message: `${story.headline} — ${SITE_URL}/noisers/${story.id}` })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share this story"
              style={styles.share}
            >
              <Ionicons name="share-outline" size={20} color={colors.paper} />
            </Pressable>
          ),
        }}
      />
      <Screen topInset="header">
        <LinearGradient colors={[`${accent}55`, "transparent"]} style={styles.wash} pointerEvents="none" />
        <Reveal>
          <View style={[styles.tag, { borderColor: accent }]}>
            <Txt style={[styles.tagText, { color: accent }]}>{story.tag}</Txt>
          </View>
          <Txt style={styles.headline} accessibilityRole="header">
            {story.headline}
          </Txt>
          <Txt style={styles.standfirst}>{story.standfirst}</Txt>
          <Txt style={[text.small, styles.meta]}>
            {timeAgo(story.publishedAt)} · {readingTime(story)} min read
            {story.matchDay ? ` · ${story.matchDay.title}` : ""}
          </Txt>
        </Reveal>

        {featured.length > 0 ? (
          <Reveal index={1}>
            <View style={styles.featured}>
              {featured.slice(0, 6).map((p) => (
                <Pressable key={p.id} onPress={() => router.push(`/player/${p.id}`)} style={styles.feature} accessibilityRole="button" accessibilityLabel={p.name}>
                  <Avatar player={p} size={52} ring={accent} />
                  <Txt style={[text.small, styles.featureName]} numberOfLines={1}>
                    {p.name.split(" ")[0]}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </Reveal>
        ) : null}

        {story.scoreline?.length ? (
          <Reveal index={2}>
            <Glass style={styles.scoreboard}>
              {story.scoreline.map((g, i) => (
                <View key={i} style={[styles.scoreRow, i > 0 ? styles.scoreDivider : null]}>
                  <Txt style={[text.semi, styles.flex, g.homeScore < g.awayScore ? styles.dim : null]} numberOfLines={1}>
                    {g.home}
                  </Txt>
                  <Txt style={styles.score}>
                    {g.homeScore}–{g.awayScore}
                  </Txt>
                  <Txt style={[text.semi, styles.flex, styles.right, g.awayScore < g.homeScore ? styles.dim : null]} numberOfLines={1}>
                    {g.away}
                  </Txt>
                </View>
              ))}
            </Glass>
          </Reveal>
        ) : null}

        {story.stats?.length ? <Figures items={story.stats.map((s) => ({ label: s.label, value: s.value }))} /> : null}

        {story.lineup ? (
          <Group title={story.lineup.team}>
            {lineup.map((p) => (
              <Row key={p.id} onPress={() => router.push(`/player/${p.id}`)}>
                <Avatar player={p} size={34} />
                <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt style={text.small}>{story.lineup!.positions[story.lineup!.playerIds.indexOf(p.id)] ?? `#${p.number}`}</Txt>
              </Row>
            ))}
          </Group>
        ) : null}

        {story.cards?.length ? (
          <Group title="On the referee's notepad">
            {story.cards.map((c, i) => {
              const p = find(c.playerId);
              return (
                <Row key={i} onPress={p ? () => router.push(`/player/${p.id}`) : undefined}>
                  <RefCard type={c.type} size="md" />
                  <View style={styles.flex}>
                    <Txt style={text.semi}>{c.name}</Txt>
                    {c.reason ? <Txt style={text.small}>{c.reason}</Txt> : null}
                  </View>
                  {c.minute != null ? <Txt style={text.small}>{`${c.minute}'`}</Txt> : null}
                </Row>
              );
            })}
          </Group>
        ) : null}

        {story.absence ? (
          <Glass style={styles.absence}>
            <Ionicons name={absenceLabel(story.absence.type).icon} size={22} color={absenceLabel(story.absence.type).tone} />
            <View style={styles.flex}>
              <Txt style={text.semi}>{absenceLabel(story.absence.type).label}</Txt>
              <Txt style={text.small}>{absencePeriod(story.absence)}</Txt>
            </View>
          </Glass>
        ) : null}

        <View style={styles.body}>
          {story.body.map((para, i) => (
            <Txt key={i} style={[styles.para, i === 0 ? styles.firstPara : null]}>
              {para}
            </Txt>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  right: { textAlign: "right" },
  dim: { color: colors.paperDim },
  share: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: glass.surface },
  wash: { position: "absolute", top: -200, left: -16, right: -16, height: 520 },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  headline: { fontFamily: fonts.displayHeavy, fontSize: 44, lineHeight: 44, color: colors.paper, marginTop: space.lg },
  standfirst: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 25, color: colors.paperDim, marginTop: space.md },
  meta: { marginTop: space.md, marginBottom: space.xl },
  featured: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.xl },
  feature: { alignItems: "center", width: 64, gap: 4 },
  featureName: { color: colors.paperDim },
  scoreboard: { paddingHorizontal: space.lg, marginBottom: space.xl },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  scoreDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: glass.edge },
  score: { fontFamily: fonts.displayHeavy, fontSize: 30, color: colors.paper, fontVariant: ["tabular-nums"] },
  absence: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, marginBottom: space.xl },
  body: { gap: space.lg },
  para: { fontFamily: fonts.body, fontSize: 17, lineHeight: 27, color: colors.paper },
  firstPara: { fontFamily: fonts.bodyMedium },
});
