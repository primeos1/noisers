import { useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useClub } from "../lib/club";
import { EMPTY_VALE, potwWinsLabel, useTeamOfWeek, useValeContent } from "../lib/content";
import { sortEvents } from "../lib/derive";
import type { MatchDayAwards, Player, TeamOfWeekPick } from "../lib/types";
import { Avatar, CardPips, Chips, Empty, ErrorBanner, PageTitle, Screen, SectionHeader, Txt, text } from "../components/ui";
import { CoverFlow, Glass, Reveal, Skeleton, Tilt } from "../components/depth";
import { CardFace, HoloCard } from "../components/PlayerCard";
import { colors, fonts, foil, radius, shadow, space } from "../theme";

// The Vale — the public awards page (frontend/src/pages/TheVale.tsx): the
// team of the week (the best six across that week's two match days)
// and each match day's team and player for any finished week, then the
// committee's (or
// the auto-awarded) player of the week, most improved, flop of the week and
// stat leaders, with the bad boy of the week.

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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "2 goals · 1 assist" — what earned a team-of-the-week pick their place. */
function pickLine(p: TeamOfWeekPick) {
  const parts = [
    p.goals > 0 && plural(p.goals, "goal"),
    p.assists > 0 && plural(p.assists, "assist"),
    p.cleanSheets > 0 && plural(p.cleanSheets, "clean sheet"),
    p.saves > 0 && plural(p.saves, "save"),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : plural(p.appearances, "game");
}

/** A match day's player and team of the match day, under the week's six. */
function MatchDayCard({ day, find }: { day: MatchDayAwards; find: (id: number) => Player | undefined }) {
  const star = day.playerOfMatchDay ? find(day.playerOfMatchDay.playerId) : undefined;
  const bad = day.badBoy ? find(day.badBoy.playerId) : undefined;
  const picks = day.lineup.map((pick) => ({ pick, player: find(pick.playerId) })).filter((x): x is { pick: TeamOfWeekPick; player: Player } => !!x.player);
  return (
    <Glass style={styles.dayCard}>
      <Txt style={text.eyebrow}>
        {day.title} · {day.date}
      </Txt>
      {star && day.playerOfMatchDay ? (
        <Tilt onPress={() => router.push(`/player/${star.id}`)} accessibilityLabel={`Player of the match day: ${star.name}, ${pickLine(day.playerOfMatchDay)}`}>
          <View style={styles.dayStar}>
            <Avatar player={star} size={48} ring={colors.gold} />
            <View style={styles.flex}>
              <Txt style={[text.small, { color: colors.gold }]}>Player of the match day</Txt>
              <Txt style={styles.dayStarName} numberOfLines={1}>
                {star.name}
              </Txt>
              <Txt style={text.small} numberOfLines={1}>
                {pickLine(day.playerOfMatchDay)}
              </Txt>
            </View>
          </View>
        </Tilt>
      ) : null}
      {bad && day.badBoy ? (
        <Tilt onPress={() => router.push(`/player/${bad.id}`)} accessibilityLabel={`Bad boy of the day: ${bad.name}, ${day.badBoy.yellowCards} yellow, ${day.badBoy.redCards} red`}>
          <View style={styles.dayStar}>
            <Avatar player={bad} size={48} ring={colors.loss} />
            <View style={styles.flex}>
              <Txt style={[text.small, { color: colors.loss }]}>Bad boy of the day</Txt>
              <Txt style={styles.dayStarName} numberOfLines={1}>
                {bad.name}
              </Txt>
            </View>
            <CardPips yellow={day.badBoy.yellowCards} red={day.badBoy.redCards} />
          </View>
        </Tilt>
      ) : (
        <Txt style={text.small}>Bad boy of the day: nobody booked — angels, the lot of them.</Txt>
      )}
      {picks.length > 0 ? (
        <>
          <Txt style={[text.small, styles.dayTeamLabel]}>Team of the match day</Txt>
          {day.team ? (
            <Txt style={styles.dayStarName}>
              {day.team.name} <Txt style={text.small}>· won {day.team.won} of {day.team.played} · {day.team.gd > 0 ? `+${day.team.gd}` : day.team.gd} GD</Txt>
            </Txt>
          ) : null}
          {picks.map(({ pick, player }) => (
            <Tilt key={player.id} onPress={() => router.push(`/player/${player.id}`)} accessibilityLabel={`${pick.position}: ${player.name}`}>
              <View style={styles.dayPick}>
                <Txt style={[text.small, styles.dayPosition]}>{pick.position}</Txt>
                <Avatar player={player} size={28} />
                <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                  {player.name}
                </Txt>
              </View>
            </Tilt>
          ))}
        </>
      ) : null}
    </Glass>
  );
}

/** "Week 3" — every two match days make a week. */
const weekLabel = (week?: number) => (week ? `Week ${week}` : null);

export default function ValeScreen() {
  const { players, events, refresh } = useClub();
  const { content, loading, error, reload } = useValeContent();
  const { width } = useWindowDimensions();

  // Every ended match day that finished a game, newest first, one per week
  // (the latest of its two match days).
  const past = useMemo(() => {
    const seen = new Set<string>();
    return sortEvents(events)
      .filter((e) => e.status === "ended" && e.games.some((g) => g.status === "finished"))
      .filter((e) => {
        const week = e.week ? `week-${e.week}` : e.id;
        if (seen.has(week)) return false;
        seen.add(week);
        return true;
      });
  }, [events]);
  const [picked, setPicked] = useState<string | null>(null);
  const eventId = picked ?? past[0]?.id ?? null;
  const { team, awards: dayAwards, loading: teamLoading } = useTeamOfWeek(eventId);
  // The saved Vale (with any committee hand-picks) belongs to the match day it
  // was written for; any other match day shows the awards worked out for it.
  const selected = past.find((e) => e.id === eventId);
  const showsSaved = !selected || (content.teamOfTheWeek.week === selected.title && content.teamOfTheWeek.dateRange === selected.date);
  const awards = showsSaved ? content : (dayAwards ?? EMPTY_VALE);

  const find = (id: number) => players.find((p) => p.id === id);
  const lineup = (team?.lineup ?? []).map((pick) => ({ pick, player: find(pick.playerId) })).filter((x): x is { pick: TeamOfWeekPick; player: Player } => !!x.player);
  const flopLineup = (team?.flopTeam?.lineupPlayerIds ?? []).map(find).filter((p): p is Player => !!p);
  const { playerOfTheWeek: potw, mostImproved, flopOfTheWeek, weeklyLeaders: w } = awards;
  const flop = find(flopOfTheWeek.playerId);
  const weekBadBoy = team?.badBoy ?? null;
  const badBoy = weekBadBoy ? find(weekBadBoy.playerId) : undefined;
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
        <PageTitle eyebrow="Updated every match day" title="The Vale" sub="Team and player of the week and of every match day, player honours and the stat leaders." />
      </Reveal>
      <ErrorBanner message={error} onRetry={reload} />

      {/* Team of the week */}
      <SectionHeader title="Team of the week" />
      {past.length > 1 ? (
        <Chips value={eventId ?? ""} onChange={setPicked} options={past.slice(0, 12).map((e) => ({ value: e.id, label: weekLabel(e.week) ?? e.title }))} />
      ) : null}
      {teamLoading ? (
        <Skeleton style={styles.teamSkeleton} />
      ) : team ? (
        <Reveal>
          <Glass style={styles.teamHead}>
            <LinearGradient colors={["rgba(216,181,106,0.3)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Txt style={styles.teamTitle}>{team.title}</Txt>
            <Txt style={[text.dim, styles.teamBody]}>
              {team.complete === false
                ? `${team.dateRange} · The team and player of the week are picked once both of the week's match days have ended.`
                : `${team.dateRange} · The week's best keeper, two defenders, midfielder and two forwards, rated across both match days.`}
            </Txt>
          </Glass>
          {lineup.length > 0 ? (
            <CoverFlow
              data={lineup}
              itemWidth={170}
              keyOf={({ player }) => player.id}
              renderItem={({ pick, player: p }) => (
                <Tilt onPress={() => router.push(`/player/${p.id}`)} accessibilityLabel={`${pick.position}: ${p.name}, ${pickLine(pick)}`}>
                  <CardFace player={p} width={170} />
                  <Txt style={[text.small, styles.pickLine]} numberOfLines={1}>
                    {pick.position} · {pickLine(pick)}
                  </Txt>
                </Tilt>
              )}
            />
          ) : null}
          {(team.matchDays ?? []).map((day) => (
            <MatchDayCard key={day.id} day={day} find={find} />
          ))}
          {team.flopTeam ? (
            <Glass style={styles.flopTeam}>
              <LinearGradient colors={["rgba(194,59,59,0.25)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.flopHead}>
                <Ionicons name="trending-down" size={16} color={colors.loss} />
                <Txt style={[text.eyebrow, { color: colors.loss }]}>Flop team of the week</Txt>
              </View>
              <Txt style={styles.flopTeamName}>{team.flopTeam.name}</Txt>
              <Txt style={text.small}>
                Won {team.flopTeam.won} of {team.flopTeam.played} · goal difference {team.flopTeam.gd > 0 ? `+${team.flopTeam.gd}` : team.flopTeam.gd}
              </Txt>
              {flopLineup.length > 0 ? (
                <View style={styles.flopLineup}>
                  {flopLineup.map((p) => (
                    <Tilt key={p.id} onPress={() => router.push(`/player/${p.id}`)} accessibilityLabel={p.name}>
                      <Avatar player={p} size={36} ring={colors.loss} />
                    </Tilt>
                  ))}
                </View>
              ) : null}
            </Glass>
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
                <View>
                  <HoloCard player={potwPlayer} width={Math.min(width * 0.55, 230)} />
                  <MaterialCommunityIcons name="crown" size={64} color={colors.goldBright} style={styles.potwCrown} pointerEvents="none" />
                </View>
                <Txt style={styles.potwName}>{potwPlayer.name}</Txt>
                {potw.timesWon > 0 ? (
                  <View style={styles.potwWins}>
                    <MaterialCommunityIcons name="crown" size={14} color={colors.ink} />
                    <Txt style={styles.potwWinsText}>{potwWinsLabel(potw.timesWon)}</Txt>
                  </View>
                ) : null}
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

      {/* Flop player of the week */}
      {flop ? (
        <Reveal index={2}>
          <SectionHeader title="Flop of the week" />
          <Tilt onPress={open(flop)} accessibilityLabel={`Flop player of the week: ${flop.name}`}>
            <Glass style={styles.mip}>
              <LinearGradient colors={["rgba(194,59,59,0.3)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Avatar player={flop} size={64} ring={colors.loss} />
              <View style={styles.flex}>
                <Txt style={styles.mipName} numberOfLines={1}>
                  {flop.name}
                </Txt>
                {flopOfTheWeek.note ? (
                  <Txt style={text.small} numberOfLines={3}>
                    {flopOfTheWeek.note}
                  </Txt>
                ) : null}
              </View>
              <Ionicons name="thumbs-down" size={22} color={colors.loss} />
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
            icon="skull"
            label="Bad boy of the week"
            player={badBoy}
            value={badBoy && weekBadBoy ? `${weekBadBoy.yellowCards}Y · ${weekBadBoy.redCards}R` : "No cards"}
            tone={colors.loss}
            onPress={open(badBoy)}
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
  pickLine: { marginTop: 8, textAlign: "center" },
  dayCard: { padding: space.lg, marginTop: space.md, gap: space.sm },
  dayStar: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: 4 },
  dayStarName: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  dayTeamLabel: { marginTop: space.sm },
  dayPick: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dayPosition: { width: 32 },

  potwSkeleton: { height: 420, borderRadius: radius.lg, marginVertical: space.xl },
  potw: { borderRadius: radius.xl, marginBottom: space.xl, marginTop: space.sm },
  potwFrame: { borderRadius: radius.xl, padding: 2 },
  potwInner: { borderRadius: radius.xl - 2, alignItems: "center", padding: space.xl, paddingTop: space.xxl },
  potwName: { fontFamily: fonts.displayHeavy, fontSize: 36, lineHeight: 38, color: colors.paper, textAlign: "center", marginTop: space.md },
  potwCrown: { position: "absolute", top: -40, alignSelf: "center", transform: [{ rotate: "-10deg" }], textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 3 } },
  potwWins: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, marginVertical: space.sm },
  potwWinsText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink, letterSpacing: 0.6, textTransform: "uppercase" },
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

  flopTeam: { padding: space.lg, marginTop: space.md, marginBottom: space.xl, gap: 4 },
  flopHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  flopTeamName: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 28, color: colors.paper },
  flopLineup: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
});
