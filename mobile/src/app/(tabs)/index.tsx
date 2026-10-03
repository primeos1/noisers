import { useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { useAuth } from "../../lib/auth";
import { useNoisers, useValeContent, KIND_ACCENT, timeAgo } from "../../lib/content";
import { absenceLabel, currentAbsence, returnHint } from "../../lib/absences";
import { cardCounts, eventGoals, eventParticipants, formatNaira, participantName, playerGameLog, plural, scoreOf, sortEvents } from "../../lib/derive";
import { resolveMediaUrl } from "../../lib/config";
import type { MatchDayEvent, MatchDayGame, ParticipantId, Player, Story } from "../../lib/types";
import { Avatar, Button, ErrorBanner, LiveTag, Pill, ResultChip, Screen, SectionHeader, Txt, text } from "../../components/ui";
import { CoverFlow, FlipNumber, Glass, PulseRing, Reveal, Skeleton, Tilt, haptic } from "../../components/depth";
import { CardFace, HoloCard } from "../../components/PlayerCard";
import { colors, fonts, foil, glass, radius, shadow, space } from "../../theme";

const crest = require("../../../assets/brand/crest.png");

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// ---- Header ----------------------------------------------------------------

function Header({ me }: { me: Player | undefined }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <View style={styles.header}>
      <Image source={crest} style={styles.crest} contentFit="contain" accessibilityIgnoresInvertColors />
      <View style={styles.flex}>
        <Txt style={text.eyebrow}>{today}</Txt>
        <Txt style={styles.hello} accessibilityRole="header" numberOfLines={1}>
          {greeting()}
          {me ? `, ${me.name.split(" ")[0]}` : ""}
        </Txt>
      </View>
      {me ? (
        <Pressable onPress={() => router.push(`/player/${me.id}`)} accessibilityRole="button" accessibilityLabel="Open your profile" hitSlop={6}>
          <Avatar player={me} size={42} ring={colors.gold} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---- Live ------------------------------------------------------------------

function LiveCard({ event }: { event: MatchDayEvent }) {
  const game = event.games.find((g) => g.status === "live") ?? event.games.at(-1);
  return (
    <Reveal>
      <Tilt onPress={() => router.push(`/match/${event.id}`)} accessibilityLabel={`${event.title} is live. Open the match sheet`} style={[styles.live, shadow.glow(colors.loss)]}>
        <LinearGradient colors={["rgba(194,59,107,0.35)", "rgba(19,26,43,0.9)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <PulseRing rounded={radius.xl} />
        <View style={styles.liveTop}>
          <LiveTag />
          <Txt style={text.small} numberOfLines={1}>
            {[event.title, event.venue].filter(Boolean).join(" · ")}
          </Txt>
        </View>
        {game ? (
          <View style={styles.liveScore}>
            <Txt style={styles.liveTeam} numberOfLines={2}>
              {game.teams[0].name}
            </Txt>
            <View style={styles.liveDigits}>
              <FlipNumber value={scoreOf(game, 0)} style={styles.liveDigit} />
              <Txt style={styles.liveColon}>:</Txt>
              <FlipNumber value={scoreOf(game, 1)} style={styles.liveDigit} />
            </View>
            <Txt style={[styles.liveTeam, styles.right]} numberOfLines={2}>
              {game.teams[1].name}
            </Txt>
          </View>
        ) : (
          <Txt style={[text.dim, styles.liveWait]}>Teams are being picked. First game soon.</Txt>
        )}
        <Txt style={[text.small, styles.center]}>Game {event.games.length || 1} · tap for the full match sheet</Txt>
      </Tilt>
    </Reveal>
  );
}

// ---- Your card -------------------------------------------------------------

function MyCard({ player }: { player: Player }) {
  const { cards, events, absences, setMyShirt } = useClub();
  const { width } = useWindowDimensions();
  const fines = cardCounts(cards, player.id);
  const form = playerGameLog(events, player.id)
    .filter((g) => g.result)
    .slice(0, 5);
  const out = currentAbsence(absences, player.id);
  const cardWidth = Math.min(width * 0.46, 210);

  return (
    <Reveal index={1}>
      <SectionHeader title="Your card" action="Profile" onAction={() => router.push(`/player/${player.id}`)} />
      <Glass style={styles.mine}>
        <HoloCard
          player={player}
          width={cardWidth}
          back={
            <View style={styles.back}>
              <Txt style={[text.eyebrow, styles.center]}>Season</Txt>
              {[
                ["Games", player.appearances],
                ["Goals", player.goals],
                ["Assists", player.assists],
                ["Rating", player.rating.toFixed(2)],
              ].map(([k, v]) => (
                <View key={k} style={styles.backRow}>
                  <Txt style={text.dim}>{k}</Txt>
                  <Txt style={styles.backValue}>{v}</Txt>
                </View>
              ))}
            </View>
          }
        />
        <View style={styles.mineSide}>
          <Txt style={text.eyebrow}>Form</Txt>
          <View style={styles.form}>
            {form.length ? form.map((g) => <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} />) : <Txt style={text.small}>No results yet</Txt>}
          </View>
          <Txt style={[text.eyebrow, styles.gapTop]}>Fines</Txt>
          <Txt style={[styles.fine, { color: fines.outstanding ? colors.loss : colors.win }]}>{fines.outstanding ? formatNaira(fines.outstanding) : "Clear"}</Txt>
          {out ? (
            <View style={styles.gapTop}>
              <Pill label={absenceLabel(out.type).short} tone={absenceLabel(out.type).tone} icon={absenceLabel(out.type).icon} />
              <Txt style={[text.small, styles.gapTiny]}>{returnHint(out)}</Txt>
            </View>
          ) : null}
          <Txt style={[text.small, styles.hint]}>Drag the card to turn it. Tap to flip.</Txt>
          <Pressable onPress={() => setMyShirt(null)} accessibilityRole="button" hitSlop={8} style={styles.notMe}>
            <Txt style={styles.notMeText}>Not me</Txt>
          </Pressable>
        </View>
      </Glass>
    </Reveal>
  );
}

function PickShirt({ players }: { players: Player[] }) {
  const { setMyShirt } = useClub();
  const sorted = useMemo(() => [...players].filter((p) => p.active).sort((a, b) => a.number - b.number), [players]);
  return (
    <Reveal index={1}>
      <SectionHeader title="Which card is yours?" />
      <Txt style={[text.dim, styles.pickBody]}>Swipe to your shirt and tap it. Your rating, form and fines move to the top. Only saved on this phone.</Txt>
      <CoverFlow
        data={sorted}
        itemWidth={150}
        keyOf={(p) => p.id}
        renderItem={(p) => (
          <Tilt
            onPress={() => {
              haptic.success();
              setMyShirt(p.id);
            }}
            accessibilityLabel={`I'm ${p.name}, number ${p.number}`}
          >
            <CardFace player={p} width={150} />
          </Tilt>
        )}
      />
    </Reveal>
  );
}

// ---- Latest match day ------------------------------------------------------

/** Day number, short month and weekday for the matchday ticket stub. */
function ticketDate(event: MatchDayEvent) {
  const parsed = new Date(event.createdAt ?? event.date);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    day: String(parsed.getDate()),
    month: parsed.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    weekday: parsed.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
  };
}

/** Whoever scored most across the day's games (own goals don't count). */
function topScorer(event: MatchDayEvent) {
  const tally = new Map<ParticipantId, number>();
  for (const g of event.games) for (const goal of g.goals) if (!goal.ownGoal) tally.set(goal.playerId, (tally.get(goal.playerId) ?? 0) + 1);
  let best: { id: ParticipantId; goals: number } | null = null;
  for (const [id, goals] of tally) if (!best || goals > best.goals) best = { id, goals };
  return best;
}

function GameLine({ game, number }: { game: MatchDayGame; number: number }) {
  const [a, b] = [scoreOf(game, 0), scoreOf(game, 1)];
  const live = game.status === "live";
  const tone = (us: number, them: number) => (live ? colors.paper : us > them ? colors.win : us < them ? colors.paperDim : colors.draw);
  return (
    <View style={styles.game}>
      <View style={[styles.gameEdge, { backgroundColor: live ? colors.loss : a === b ? colors.draw : colors.win }]} />
      <Txt style={[styles.gameNo, live ? { color: colors.loss } : null]}>{live ? "LIVE" : `G${number}`}</Txt>
      <Txt style={[styles.gameTeam, a < b && !live ? styles.dim : null]} numberOfLines={1}>
        {game.teams[0].name}
      </Txt>
      <View style={[styles.digits, live ? styles.digitsLive : null]}>
        <Txt style={[styles.digit, { color: tone(a, b) }]}>{a}</Txt>
        <View style={styles.digitRule} />
        <Txt style={[styles.digit, { color: tone(b, a) }]}>{b}</Txt>
      </View>
      <Txt style={[styles.gameTeam, styles.right, b < a && !live ? styles.dim : null]} numberOfLines={1}>
        {game.teams[1].name}
      </Txt>
    </View>
  );
}

function LatestMatchDay({ event, players }: { event: MatchDayEvent; players: Player[] }) {
  const date = ticketDate(event);
  const scorer = topScorer(event);
  const scorerPlayer = typeof scorer?.id === "number" ? players.find((p) => p.id === scorer.id) : undefined;
  const shown = event.games.slice(0, 5);
  const figures: [string, number][] = [
    ["Games", event.games.length],
    ["Goals", eventGoals(event)],
    ["Players", eventParticipants(event)],
  ];

  return (
    <Reveal index={2}>
      <SectionHeader title="Latest match day" action="All matches" onAction={() => router.push("/matches")} />
      <Tilt onPress={() => router.push(`/match/${event.id}`)} accessibilityLabel={`${event.title}. Open the match sheet`} style={[styles.ticket, shadow.card]} max={5}>
        <LinearGradient colors={["#1b2540", "#0f1527", colors.inkDeep]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ticketTrim} />
        <Txt style={styles.watermark} numberOfLines={1} accessible={false}>
          MATCHDAY
        </Txt>

        {/* Stub: the date in gold, then title and venue */}
        <View style={styles.ticketHead}>
          <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stub}>
            {date ? (
              <>
                <Txt style={styles.stubWeekday}>{date.weekday}</Txt>
                <Txt style={styles.stubDay}>{date.day}</Txt>
                <Txt style={styles.stubMonth}>{date.month}</Txt>
              </>
            ) : (
              <Ionicons name="calendar" size={26} color={colors.ink} />
            )}
          </LinearGradient>
          <View style={styles.flex}>
            {event.status === "live" ? <LiveTag /> : <Txt style={styles.fullTime}>FULL TIME</Txt>}
            <Txt style={styles.ticketTitle} numberOfLines={2}>
              {event.title}
            </Txt>
            {event.venue ? (
              <View style={styles.venue}>
                <Ionicons name="location" size={12} color={colors.mist} />
                <Txt style={[text.small, styles.flex]} numberOfLines={1}>
                  {event.venue}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.figures}>
          {figures.map(([label, value], i) => (
            <View key={label} style={[styles.figure, i > 0 ? styles.figureRule : null]}>
              <Txt style={styles.figureValue}>{value}</Txt>
              <Txt style={styles.figureLabel}>{label}</Txt>
            </View>
          ))}
        </View>

        {/* Perforation between the stub and the results */}
        <View style={styles.perf}>
          <View style={[styles.notch, styles.notchLeft]} />
          <View style={styles.perfLine} />
          <View style={[styles.notch, styles.notchRight]} />
        </View>

        <View style={styles.games}>
          {shown.length === 0 ? (
            <Txt style={[text.small, styles.center]}>Teams are being picked. No games yet.</Txt>
          ) : (
            shown.map((g, i) => <GameLine key={g.id} game={g} number={i + 1} />)
          )}
          {event.games.length > shown.length ? <Txt style={[text.small, styles.center]}>+{event.games.length - shown.length} more games</Txt> : null}
        </View>

        <View style={styles.ticketFoot}>
          {scorer ? (
            <View style={styles.scorer}>
              {scorerPlayer ? <Avatar player={scorerPlayer} size={34} ring={colors.gold} /> : <Ionicons name="football" size={22} color={colors.gold} />}
              <View style={styles.flex}>
                <Txt style={styles.scorerLabel}>Top scorer</Txt>
                <Txt style={text.semi} numberOfLines={1}>
                  {participantName(players, event.guests, scorer.id)} · {plural(scorer.goals, "goal")}
                </Txt>
              </View>
            </View>
          ) : (
            <View style={styles.flex} />
          )}
          <View style={styles.sheetLink}>
            <Txt style={styles.sheetLinkText}>Match sheet</Txt>
            <Ionicons name="arrow-forward" size={14} color={colors.ink} />
          </View>
        </View>
      </Tilt>
    </Reveal>
  );
}

// ---- The Vale --------------------------------------------------------------

function PlayerOfTheWeek({ players }: { players: Player[] }) {
  const { content, loading } = useValeContent();
  const potw = players.find((p) => p.id === content.playerOfTheWeek.playerId);
  if (loading) return <Skeleton style={styles.potwSkeleton} />;
  if (!potw) return null;
  return (
    <Reveal index={3}>
      <SectionHeader title="The Vale" action="Awards" onAction={() => router.push("/vale")} />
      <Tilt onPress={() => router.push("/vale")} accessibilityLabel={`Player of the week: ${potw.name}. Open The Vale`} style={[styles.potw, shadow.glow(colors.gold)]}>
        <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.potwFrame}>
          <View style={styles.potwInner}>
            <Image source={{ uri: resolveMediaUrl(potw.photoUrl) ?? `https://i.pravatar.cc/400?img=${(potw.id % 70) + 1}` }} style={styles.potwPhoto} contentFit="cover" />
            <LinearGradient colors={["rgba(10,14,26,0)", "rgba(10,14,26,0.85)", colors.ink]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            <View style={styles.potwText}>
              <View style={styles.potwBadge}>
                <Ionicons name="trophy" size={12} color={colors.ink} />
                <Txt style={styles.potwBadgeText}>Player of the week</Txt>
              </View>
              <Txt style={styles.potwName} numberOfLines={2}>
                {potw.name}
              </Txt>
              {content.playerOfTheWeek.weekRating ? <Txt style={styles.potwRating}>{content.playerOfTheWeek.weekRating.toFixed(1)}</Txt> : null}
              {content.playerOfTheWeek.note ? (
                <Txt style={[text.small, styles.potwNote]} numberOfLines={3}>
                  {content.playerOfTheWeek.note}
                </Txt>
              ) : null}
            </View>
          </View>
        </LinearGradient>
      </Tilt>
    </Reveal>
  );
}

// ---- Noisers ---------------------------------------------------------------

/** A magazine-style cover: the lead player's photo full-bleed, headline over it. */
function StoryCover({ story, players, width }: { story: Story; players: Player[]; width: number }) {
  const accent = KIND_ACCENT[story.kind];
  const lead = players.find((p) => p.id === story.playerIds[0]);
  const uri = lead ? (resolveMediaUrl(lead.photoUrl) ?? `https://i.pravatar.cc/600?img=${(lead.id % 70) + 1}`) : null;
  const score = story.scoreline?.[0];
  return (
    <Tilt onPress={() => router.push(`/noisers/${story.id}`)} accessibilityLabel={`${story.tag}: ${story.headline}`}>
      <View style={[styles.story, { width }, shadow.card]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={200} recyclingKey={uri} />
        ) : (
          <LinearGradient colors={[`${accent}88`, colors.inkRaised]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.storyFallback]}>
            <Image source={crest} style={styles.storyCrest} contentFit="contain" />
          </LinearGradient>
        )}
        <LinearGradient colors={["rgba(10,14,26,0.4)", "rgba(10,14,26,0)", "rgba(10,14,26,0.85)", colors.ink]} locations={[0, 0.28, 0.66, 1]} style={StyleSheet.absoluteFill} />
        <View style={[styles.storyAccent, { backgroundColor: accent }]} />

        <View style={styles.storyTop}>
          <View style={[styles.storyTag, { backgroundColor: accent }]}>
            <Txt style={styles.storyTagText}>{story.tag}</Txt>
          </View>
          {score ? (
            <View style={styles.storyScore}>
              <Txt style={styles.storyScoreText}>
                {score.homeScore}–{score.awayScore}
              </Txt>
            </View>
          ) : null}
        </View>

        <View style={styles.storyBody}>
          <Txt style={styles.storyHeadline} numberOfLines={3}>
            {story.headline}
          </Txt>
          <Txt style={[text.small, styles.storyStand]} numberOfLines={2}>
            {story.standfirst}
          </Txt>
          <View style={styles.storyMeta}>
            <Txt style={text.small}>{timeAgo(story.publishedAt)}</Txt>
            <View style={styles.storyRead}>
              <Txt style={[styles.storyReadText, { color: accent }]}>Read</Txt>
              <Ionicons name="arrow-forward" size={13} color={accent} />
            </View>
          </View>
        </View>
      </View>
    </Tilt>
  );
}

function Stories({ players }: { players: Player[] }) {
  const { stories, loading } = useNoisers();
  const { width } = useWindowDimensions();
  if (loading) return <Skeleton style={styles.storySkeleton} />;
  if (stories.length === 0) return null;
  const w = Math.min(width * 0.8, 340);
  return (
    <Reveal index={4}>
      <SectionHeader title="Noisers" action="Read all" onAction={() => router.push("/noisers")} />
      <CoverFlow data={stories.slice(0, 8)} itemWidth={w} keyOf={(s) => s.id} renderItem={(s) => <StoryCover story={s} players={players} width={w} />} />
    </Reveal>
  );
}

// ---- Who's out ---------------------------------------------------------------

function WhosOut({ players }: { players: Player[] }) {
  const { absences } = useClub();
  const out = absences.filter((a) => a.status === "active");
  if (out.length === 0) return null;
  return (
    <Reveal index={5}>
      <SectionHeader title="Who's out" />
      <Glass style={styles.outCard}>
        {out.slice(0, 6).map((a, i) => {
          const p = players.find((x) => x.id === a.playerId);
          if (!p) return null;
          const t = absenceLabel(a.type);
          return (
            <Pressable
              key={a.id}
              onPress={() => router.push(`/player/${p.id}`)}
              style={({ pressed }) => [styles.outRow, i > 0 ? styles.outDivider : null, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}, ${t.short}. ${returnHint(a)}`}
            >
              <Avatar player={p} size={38} ring={t.tone} />
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  {[a.reason, returnHint(a)].filter(Boolean).join(" · ")}
                </Txt>
              </View>
              <Pill label={t.short} tone={t.tone} icon={t.icon} />
            </Pressable>
          );
        })}
      </Glass>
    </Reveal>
  );
}

// ---- Screen ----------------------------------------------------------------

export default function HomeScreen() {
  const { players, events, error, refresh, myShirt, loading } = useClub();
  const { status } = useAuth();
  const me = players.find((p) => p.id === myShirt);
  const sorted = sortEvents(events);
  const live = sorted.find((e) => e.status === "live");
  const latest = sorted.find((e) => e !== live);

  return (
    <Screen onRefresh={refresh} topInset>
      <Header me={me} />
      <ErrorBanner message={error} onRetry={refresh} />

      {live ? <LiveCard event={live} /> : null}

      {loading && players.length === 0 ? (
        <Skeleton style={styles.cardSkeleton} />
      ) : me ? (
        <MyCard player={me} />
      ) : players.length > 0 && status !== "signedIn" ? (
        <PickShirt players={players} />
      ) : null}

      {latest ? <LatestMatchDay event={latest} players={players} /> : null}
      <PlayerOfTheWeek players={players} />
      <Stories players={players} />
      <WhosOut players={players} />

      <Reveal index={6}>
        <View style={styles.cta}>
          <Button label="Meet the club" variant="secondary" icon="people" onPress={() => router.push("/executives")} />
        </View>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  dim: { color: colors.paperDim },
  pressed: { backgroundColor: glass.pressed },
  gapTop: { marginTop: space.md },
  gapTiny: { marginTop: 4 },

  header: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xl },
  crest: { width: 44, height: 44 },
  hello: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 32, color: colors.paper, marginTop: 2 },

  live: { borderRadius: radius.xl, padding: space.lg, marginBottom: space.xl, overflow: "hidden", backgroundColor: colors.inkRaised },
  liveTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  liveScore: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.lg },
  liveTeam: { flex: 1, fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: colors.paper },
  liveDigits: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDigit: { fontFamily: fonts.displayHeavy, fontSize: 64, lineHeight: 68, color: colors.paper, fontVariant: ["tabular-nums"], textShadowColor: "rgba(255,111,159,0.6)", textShadowRadius: 18 },
  liveColon: { fontFamily: fonts.displayHeavy, fontSize: 44, color: "rgba(246,246,243,0.35)" },
  liveWait: { marginVertical: space.lg, textAlign: "center" },

  mine: { flexDirection: "row", gap: space.lg, padding: space.lg, marginBottom: space.xl, alignItems: "center" },
  mineSide: { flex: 1, minWidth: 0 },
  form: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  fine: { fontFamily: fonts.displayHeavy, fontSize: 26, marginTop: 2 },
  hint: { marginTop: space.md, lineHeight: 16 },
  notMe: { marginTop: space.md, alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  notMeText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim, textDecorationLine: "underline" },
  back: { gap: 10 },
  backRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  backValue: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  cardSkeleton: { height: 300, marginBottom: space.xl, borderRadius: radius.lg },

  pickBody: { marginTop: -4, lineHeight: 20 },

  ticket: { marginBottom: space.xl, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.inkRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  ticketTrim: { height: 3 },
  watermark: { position: "absolute", top: 4, right: -8, fontFamily: fonts.displayHeavy, fontSize: 84, lineHeight: 88, letterSpacing: 2, color: "rgba(255,255,255,0.035)" },
  ticketHead: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingTop: space.lg },
  stub: { width: 70, height: 84, borderRadius: radius.md, alignItems: "center", justifyContent: "center", ...shadow.glow(colors.gold) },
  stubWeekday: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.4, color: "rgba(10,14,26,0.7)" },
  stubDay: { fontFamily: fonts.displayHeavy, fontSize: 38, lineHeight: 40, color: colors.ink },
  stubMonth: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, color: colors.ink },
  fullTime: { alignSelf: "flex-start", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.6, color: colors.goldBright, backgroundColor: "rgba(212,169,58,0.14)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  ticketTitle: { fontFamily: fonts.displayHeavy, fontSize: 28, lineHeight: 29, color: colors.paper, marginTop: 6 },
  venue: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  figures: { flexDirection: "row", marginTop: space.lg, marginHorizontal: space.lg, backgroundColor: "rgba(5,7,15,0.45)", borderRadius: radius.md, paddingVertical: space.md },
  figure: { flex: 1, alignItems: "center" },
  figureRule: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: glass.edgeBright },
  figureValue: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 28, color: colors.paper, fontVariant: ["tabular-nums"] },
  figureLabel: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.2, color: colors.mist, textTransform: "uppercase", marginTop: 2 },
  perf: { flexDirection: "row", alignItems: "center", marginVertical: space.lg },
  notch: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.ink },
  notchLeft: { marginLeft: -11 },
  notchRight: { marginRight: -11 },
  perfLine: { flex: 1, height: 1, marginHorizontal: space.sm, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.14)" },
  games: { paddingHorizontal: space.lg, gap: space.sm },
  game: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 50, paddingRight: space.md, borderRadius: radius.sm + 4, backgroundColor: glass.raised, overflow: "hidden" },
  gameEdge: { width: 3, alignSelf: "stretch" },
  gameNo: { width: 34, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1, color: colors.mist, textAlign: "center" },
  gameTeam: { flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: 17, color: colors.paper },
  digits: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.inkDeep, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  digitsLive: { borderColor: colors.loss },
  digit: { fontFamily: fonts.displayHeavy, fontSize: 24, lineHeight: 28, fontVariant: ["tabular-nums"], minWidth: 14, textAlign: "center" },
  digitRule: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.18)" },
  ticketFoot: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, marginTop: space.sm },
  scorer: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.sm },
  scorerLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2, color: colors.goldBright, textTransform: "uppercase" },
  sheetLink: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.paper, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 36 },
  sheetLinkText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },

  potwSkeleton: { height: 190, marginBottom: space.xl, borderRadius: radius.lg },
  potw: { marginBottom: space.xl, borderRadius: radius.lg },
  potwFrame: { borderRadius: radius.lg, padding: 2 },
  potwInner: { height: 200, borderRadius: radius.lg - 2, overflow: "hidden", backgroundColor: colors.ink },
  potwPhoto: { position: "absolute", left: 0, top: 0, bottom: 0, width: "55%" },
  potwText: { position: "absolute", right: space.lg, top: space.lg, bottom: space.lg, left: "38%", justifyContent: "center", alignItems: "flex-end" },
  potwBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  potwBadgeText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.ink, letterSpacing: 0.6, textTransform: "uppercase" },
  potwName: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 30, color: colors.paper, textAlign: "right", marginTop: 8 },
  potwRating: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, color: colors.goldBright },
  potwNote: { textAlign: "right", color: colors.paperDim, lineHeight: 16 },

  storySkeleton: { height: 400, marginBottom: space.xl, borderRadius: radius.xl },
  story: { height: 400, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.inkRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  storyFallback: { alignItems: "center", justifyContent: "center" },
  storyCrest: { width: 120, height: 120, opacity: 0.35, marginBottom: 120 },
  storyAccent: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  storyTop: { position: "absolute", top: space.md, left: space.md, right: space.md, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  storyTag: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  storyTagText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.4, color: colors.ink },
  storyScore: { backgroundColor: "rgba(5,7,15,0.75)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  storyScoreText: { fontFamily: fonts.displayHeavy, fontSize: 20, color: colors.paper, fontVariant: ["tabular-nums"] },
  storyBody: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg },
  storyHeadline: { fontFamily: fonts.displayHeavy, fontSize: 28, lineHeight: 29, color: colors.paper, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 },
  storyStand: { marginTop: 6, lineHeight: 17, color: colors.paperDim },
  storyMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  storyRead: { flexDirection: "row", alignItems: "center", gap: 4 },
  storyReadText: { fontFamily: fonts.bodyBold, fontSize: 13 },

  outCard: { marginBottom: space.xl },
  outRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 60 },
  outDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.07)" },

  cta: { marginTop: space.sm },
});
