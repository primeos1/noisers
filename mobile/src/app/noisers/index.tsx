import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useClub } from "../../lib/club";
import { DESKS, KIND_ACCENT, readingTime, timeAgo, useNoisers } from "../../lib/content";
import type { Player, Story } from "../../lib/types";
import { Avatar, Chips, Empty, ErrorBanner, PageTitle, Screen, Txt, text } from "../../components/ui";
import { Glass, Reveal, Skeleton, Tilt } from "../../components/depth";
import { colors, fonts, radius, shadow, space } from "../../theme";

// Noisers — the club blog (frontend/src/pages/Noisers.tsx). Stories are
// written by the API from match days, cards and absences.

function Faces({ ids, players }: { ids: number[]; players: Player[] }) {
  const faces = ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p).slice(0, 4);
  if (faces.length === 0) return null;
  return (
    <View style={styles.faces}>
      {faces.map((p, i) => (
        <View key={p.id} style={[styles.face, { marginLeft: i ? -10 : 0, zIndex: 10 - i }]}>
          <Avatar player={p} size={28} ring={colors.ink} />
        </View>
      ))}
    </View>
  );
}

function Lead({ story, players }: { story: Story; players: Player[] }) {
  const accent = KIND_ACCENT[story.kind];
  return (
    <Tilt onPress={() => router.push(`/noisers/${story.id}`)} accessibilityLabel={`${story.tag}: ${story.headline}`} style={[styles.lead, shadow.glow(accent)]} max={6}>
      <Glass style={styles.leadInner} rounded={radius.xl}>
        <LinearGradient colors={[`${accent}66`, `${accent}10`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.tag, { borderColor: accent }]}>
          <Txt style={[styles.tagText, { color: accent }]}>{story.tag}</Txt>
        </View>
        <Txt style={styles.leadHeadline}>{story.headline}</Txt>
        <Txt style={[text.dim, styles.leadStand]} numberOfLines={3}>
          {story.standfirst}
        </Txt>
        {story.scoreline?.length ? (
          <View style={styles.scores}>
            {story.scoreline.slice(0, 3).map((g, i) => (
              <Txt key={i} style={styles.scoreText} numberOfLines={1}>
                {g.home} {g.homeScore}–{g.awayScore} {g.away}
              </Txt>
            ))}
          </View>
        ) : null}
        <View style={styles.meta}>
          <Faces ids={story.playerIds} players={players} />
          <Txt style={text.small}>
            {timeAgo(story.publishedAt)} · {readingTime(story)} min read
          </Txt>
        </View>
      </Glass>
    </Tilt>
  );
}

function StoryRow({ story, players, index }: { story: Story; players: Player[]; index: number }) {
  const accent = KIND_ACCENT[story.kind];
  return (
    <Reveal index={index}>
      <Tilt onPress={() => router.push(`/noisers/${story.id}`)} accessibilityLabel={`${story.tag}: ${story.headline}`} style={styles.rowWrap} max={5}>
        <Glass style={styles.row}>
          <View style={[styles.accent, { backgroundColor: accent }]} />
          <View style={styles.flex}>
            <Txt style={[styles.rowTag, { color: accent }]}>{story.tag}</Txt>
            <Txt style={styles.rowHeadline} numberOfLines={3}>
              {story.headline}
            </Txt>
            <Txt style={[text.small, styles.rowStand]} numberOfLines={2}>
              {story.standfirst}
            </Txt>
            <View style={styles.meta}>
              <Faces ids={story.playerIds} players={players} />
              <Txt style={text.small}>{timeAgo(story.publishedAt)}</Txt>
            </View>
          </View>
        </Glass>
      </Tilt>
    </Reveal>
  );
}

export default function NoisersScreen() {
  const { players } = useClub();
  const { stories, loading, error, reload } = useNoisers();
  const [desk, setDesk] = useState("all");
  const kinds = DESKS.find((d) => d.id === desk)?.kinds ?? [];
  const visible = kinds.length ? stories.filter((s) => kinds.includes(s.kind)) : stories;
  const [lead, ...rest] = visible;

  return (
    <Screen onRefresh={reload} topInset="header">
      <Reveal>
        <PageTitle eyebrow="The club blog" title="Noisers" sub="Match reports, the treatment room and the disciplinary desk — written the moment it happens." />
      </Reveal>
      <ErrorBanner message={error} onRetry={reload} />
      <Chips value={desk} onChange={setDesk} options={DESKS.map((d) => ({ value: d.id, label: d.label }))} />

      {loading ? (
        <>
          <Skeleton style={styles.leadSkeleton} />
          <Skeleton style={styles.rowSkeleton} />
          <Skeleton style={styles.rowSkeleton} />
        </>
      ) : !lead ? (
        <Empty icon="newspaper-outline">Nothing on this desk yet. Stories appear as match days are played.</Empty>
      ) : (
        <>
          <Reveal>
            <Lead story={lead} players={players} />
          </Reveal>
          {rest.map((s, i) => (
            <StoryRow key={s.id} story={s} players={players} index={i + 1} />
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  leadSkeleton: { height: 300, borderRadius: radius.xl, marginBottom: space.lg },
  rowSkeleton: { height: 130, borderRadius: radius.lg, marginBottom: space.md },

  lead: { marginBottom: space.xl, borderRadius: radius.xl },
  leadInner: { padding: space.xl },
  tag: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  leadHeadline: { fontFamily: fonts.displayHeavy, fontSize: 38, lineHeight: 38, color: colors.paper, marginTop: space.lg },
  leadStand: { marginTop: space.md, lineHeight: 21 },
  scores: { marginTop: space.lg, gap: 4 },
  scoreText: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.paper, fontVariant: ["tabular-nums"] },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, gap: space.md },
  faces: { flexDirection: "row" },
  face: { borderRadius: 16 },

  rowWrap: { marginBottom: space.md },
  row: { flexDirection: "row", gap: space.md, padding: space.lg },
  accent: { width: 3, borderRadius: 2, alignSelf: "stretch" },
  rowTag: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  rowHeadline: { fontFamily: fonts.display, fontSize: 22, lineHeight: 23, color: colors.paper, marginTop: 4 },
  rowStand: { marginTop: 6, lineHeight: 17, color: colors.paperDim },
});
