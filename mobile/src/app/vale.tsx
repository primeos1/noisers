import { useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../lib/club";
import { useTeamOfWeek, useValeContent } from "../lib/content";
import { sortEvents } from "../lib/derive";
import type { Player } from "../lib/types";
import { Avatar, Chips, Empty, ErrorBanner, PageTitle, Screen, SectionHeader, Txt, text } from "../components/ui";
import { CoverFlow, Glass, Reveal, Skeleton, Tilt } from "../components/depth";
import { CardFace, HoloCard } from "../components/PlayerCard";
import { colors, fonts, foil, radius, shadow, space } from "../theme";

// The Vale — the public awards page (frontend/src/pages/TheVale.tsx): the
// team of the week from any finished match day, then the committee's (or
// the auto-awarded) player of the week, most improved and stat leaders.

function Leader({ icon, label, player, value, tone, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; player?: Player; value: string; tone: string; onPress?: () => void }) {
  return (
    <Tilt onPress={onPress} accessibilityLabel={`${label}: ${player?.name ?? "nobody yet"}, ${value}`} containerStyle={styles.leaderCell}>
      <Glass style={styles.leader}>
        <LinearGradient colors={[`${tone}33`, "transparent"]} style={StyleSheet.absoluteFill} />
        <View style={styles.leaderTop}>
          <Ionicons name={icon} size={16} color={tone} />
          <Txt style={[text.eyebrow, styles.leaderLabel]} numberOfLines={1}>
            {label}
          </Txt>
        </View>
        {player ? <Avatar player={player} size={44} ring={tone} /> : <View style={styles.leaderBlank} />}
        <Txt style={[text.semi, styles.leaderName]} numberOfLines={1}>
          {player?.name ?? "—"}
        </Txt>
        <Txt style={[styles.leaderValue, { color: tone }]}>{value}</Txt>
      </Glass>
    </Tilt>
  );
}

export default function ValeScreen() {
  const { players, events, refresh } = useClub();
  const { content, loading, error, reload } = useValeContent();
  const { width } = useWindowDimensions();

  // Every ended match day that finished a game, newest first.
  const past = useMemo(() => sortEvents(events).filter((e) => e.status === "ended" && e.games.some((g) => g.status === "finished")), [events]);
  const [picked, setPicked] = useState<string | null>(null);
  const eventId = picked ?? past[0]?.id ?? null;
  const { team, loading: teamLoading } = useTeamOfWeek(eventId);

  const find = (id: number) => players.find((p) => p.id === id);
  const lineup = (team?.lineupPlayerIds ?? []).map(find).filter((p): p is Player => !!p);
  const { playerOfTheWeek: potw, mostImproved, weeklyLeaders: w } = content;
  const potwPlayer = find(potw.playerId);
  const mip = find(mostImproved.playerId);
  const delta = mostImproved.currentRating - mostImproved.previousRating;
  const open = (p?: Player) => (p ? () => router.push(`/player/${p.id}`) : undefined);

  return (
    <Screen
      onRefresh={async () => {
        await Promise.all([refresh(), reload()]);
      }}
      topInset="header"
    >
      <Reveal>
        <PageTitle eyebrow="Updated every match day" title="The Vale" sub="Team of the week, player honours and the stat leaders." />
      </Reveal>
      <ErrorBanner message={error} onRetry={reload} />

      {/* Team of the week */}
      <SectionHeader title="Team of the week" />
      {past.length > 1 ? (
        <Chips value={eventId ?? ""} onChange={setPicked} options={past.slice(0, 12).map((e) => ({ value: e.id, label: e.title }))} />
      ) : null}
      {teamLoading ? (
        <Skeleton style={styles.teamSkeleton} />
      ) : team ? (
        <Reveal>
          <Glass style={styles.teamHead}>
            <LinearGradient colors={["rgba(216,181,106,0.3)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Txt style={styles.teamTitle}>{team.title}</Txt>
            <Txt style={[text.dim, styles.teamBody]}>
              {team.dateRange} · {team.sessionsWon} of {team.sessionsPlayed} won, capped by a {team.score} win over {team.rivalTeam}.
            </Txt>
          </Glass>
          {lineup.length > 0 ? (
            <CoverFlow
              data={lineup}
              itemWidth={170}
              keyOf={(p) => p.id}
              renderItem={(p) => (
                <Tilt onPress={() => router.push(`/player/${p.id}`)} accessibilityLabel={`${p.name}, number ${p.number}`}>
                  <CardFace player={p} width={170} />
                </Tilt>
              )}
            />
          ) : null}
        </Reveal>
      ) : (
        <Empty icon="trophy-outline">No finished match days yet. The team of the week appears after the first one.</Empty>
      )}

      {/* Player of the week */}
      {loading ? (
        <Skeleton style={styles.potwSkeleton} />
      ) : potwPlayer ? (
        <Reveal index={1}>
          <SectionHeader title="Player of the week" />
          <View style={[styles.potw, shadow.glow(colors.gold)]}>
            <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.potwFrame}>
              <LinearGradient colors={["#1b2440", colors.ink]} style={styles.potwInner}>
                <HoloCard player={potwPlayer} width={Math.min(width * 0.55, 230)} />
                <Txt style={styles.potwName}>{potwPlayer.name}</Txt>
                {potw.weekRating ? (
                  <View style={styles.potwRatingRow}>
                    <Txt style={styles.potwRating}>{potw.weekRating.toFixed(1)}</Txt>
                    <Txt style={text.small}>week rating</Txt>
                  </View>
                ) : null}
                {potw.note ? <Txt style={[text.dim, styles.potwNote]}>{potw.note}</Txt> : null}
              </LinearGradient>
            </LinearGradient>
          </View>
        </Reveal>
      ) : null}

      {/* Most improved */}
      {mip ? (
        <Reveal index={2}>
          <SectionHeader title="Most improved" />
          <Tilt onPress={open(mip)} accessibilityLabel={`Most improved: ${mip.name}`}>
            <Glass style={styles.mip}>
              <LinearGradient colors={["rgba(47,158,138,0.3)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Avatar player={mip} size={64} ring={colors.win} />
              <View style={styles.flex}>
                <Txt style={styles.mipName} numberOfLines={1}>
                  {mip.name}
                </Txt>
                <View style={styles.mipRatings}>
                  <Txt style={styles.mipOld}>{mostImproved.previousRating.toFixed(1)}</Txt>
                  <Ionicons name="arrow-forward" size={16} color={colors.win} />
                  <Txt style={styles.mipNew}>{mostImproved.currentRating.toFixed(1)}</Txt>
                  {delta > 0 ? <Txt style={styles.mipDelta}>+{delta.toFixed(1)}</Txt> : null}
                </View>
                {mostImproved.note ? (
                  <Txt style={text.small} numberOfLines={3}>
                    {mostImproved.note}
                  </Txt>
                ) : null}
              </View>
            </Glass>
          </Tilt>
        </Reveal>
      ) : null}

      {/* Weekly leaders */}
      <Reveal index={3}>
        <SectionHeader title="This week's leaders" />
        <View style={styles.leaders}>
          <Leader icon="football" label="Top scorer" player={find(w.topScorer.playerId)} value={`${w.topScorer.value} goals`} tone={colors.win} onPress={open(find(w.topScorer.playerId))} />
          <Leader icon="git-merge" label="Top assist" player={find(w.topAssist.playerId)} value={`${w.topAssist.value} assists`} tone={colors.travel} onPress={open(find(w.topAssist.playerId))} />
          <Leader icon="hand-left" label="Top saves" player={find(w.topSaves.playerId)} value={`${w.topSaves.value} saves`} tone={colors.gold} onPress={open(find(w.topSaves.playerId))} />
          <Leader
            icon="alert-circle"
            label="Roughest"
            player={find(w.roughest.playerId)}
            value={`${w.roughest.yellowCards}Y · ${w.roughest.redCards}R`}
            tone={colors.loss}
            onPress={open(find(w.roughest.playerId))}
          />
        </View>
        {w.cleanSheetTeam.name ? (
          <Glass style={styles.cleanSheet}>
            <Ionicons name="shield-checkmark" size={22} color={colors.win} />
            <View style={styles.flex}>
              <Txt style={text.eyebrow}>Clean sheets</Txt>
              <Txt style={text.semi}>{w.cleanSheetTeam.name}</Txt>
            </View>
            <Txt style={styles.cleanValue}>{w.cleanSheetTeam.value}</Txt>
          </Glass>
        ) : null}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  teamSkeleton: { height: 320, borderRadius: radius.lg, marginBottom: space.xl },
  teamHead: { padding: space.lg },
  teamTitle: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 34, color: colors.paper },
  teamBody: { marginTop: 6, lineHeight: 20 },

  potwSkeleton: { height: 420, borderRadius: radius.lg, marginVertical: space.xl },
  potw: { borderRadius: radius.xl, marginBottom: space.xl, marginTop: space.sm },
  potwFrame: { borderRadius: radius.xl, padding: 2 },
  potwInner: { borderRadius: radius.xl - 2, alignItems: "center", padding: space.xl, paddingTop: space.xxl },
  potwName: { fontFamily: fonts.displayHeavy, fontSize: 36, lineHeight: 38, color: colors.paper, textAlign: "center", marginTop: space.md },
  potwRatingRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  potwRating: { fontFamily: fonts.displayHeavy, fontSize: 44, color: colors.goldBright },
  potwNote: { textAlign: "center", lineHeight: 20, marginTop: space.sm },

  mip: { flexDirection: "row", gap: space.lg, padding: space.lg, alignItems: "center", marginBottom: space.xl },
  mipName: { fontFamily: fonts.display, fontSize: 24, color: colors.paper },
  mipRatings: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
  mipOld: { fontFamily: fonts.display, fontSize: 22, color: colors.mist, textDecorationLine: "line-through" },
  mipNew: { fontFamily: fonts.displayHeavy, fontSize: 28, color: colors.paper },
  mipDelta: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.win, backgroundColor: "rgba(47,158,138,0.18)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },

  leaders: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.md },
  leaderCell: { flexBasis: "47%", flexGrow: 1 },
  leader: { padding: space.lg, alignItems: "flex-start", gap: 6, minHeight: 170 },
  leaderTop: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  leaderLabel: { flexShrink: 1 },
  leaderBlank: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.06)" },
  leaderName: { fontSize: 14 },
  leaderValue: { fontFamily: fonts.display, fontSize: 20 },
  cleanSheet: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, marginBottom: space.xl },
  cleanValue: { fontFamily: fonts.displayHeavy, fontSize: 32, color: colors.win },
});
