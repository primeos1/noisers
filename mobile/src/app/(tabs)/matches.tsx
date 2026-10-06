import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { eventGoals, eventParticipants, participantName, plural, scoreOf, sortEvents } from "../../lib/derive";
import type { MatchDayEvent, MatchDayGame, ParticipantId, Player } from "../../lib/types";
import { Avatar, Empty, ErrorBanner, LiveTag, Loading, PageTitle, RefCard, Screen, Segmented, Txt, text } from "../../components/ui";
import { FlipNumber, Glass, PulseRing, Reveal, Tilt } from "../../components/depth";
import { colors, fonts, foil, glass, radius, shadow, space } from "../../theme";

type Filter = "all" | "ended" | "live";

// ---- Helpers ---------------------------------------------------------------

function eventDate(event: MatchDayEvent) {
  const parsed = new Date(event.createdAt ?? event.date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "Sat 27 Sep 2026" style dates → a day number, short month and weekday. */
function dateParts(event: MatchDayEvent) {
  const parsed = eventDate(event);
  if (!parsed) return { day: "–", month: "", weekday: "" };
  return {
    day: String(parsed.getDate()),
    month: parsed.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    weekday: parsed.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
  };
}

/** Match days bucketed by month, newest first ("September 2026"). */
function byMonth(events: MatchDayEvent[]) {
  const groups: { label: string; events: MatchDayEvent[] }[] = [];
  for (const e of events) {
    const d = eventDate(e);
    const label = d ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Undated";
    const last = groups.at(-1);
    if (last && last.label === label) last.events.push(e);
    else groups.push({ label, events: [e] });
  }
  return groups;
}

type Leader = { id: ParticipantId; count: number };

/** Highest tally in a list of participant ids, or null when empty. */
function leader(ids: ParticipantId[]): Leader | null {
  const tally = new Map<ParticipantId, number>();
  for (const id of ids) tally.set(id, (tally.get(id) ?? 0) + 1);
  let best: Leader | null = null;
  for (const [id, count] of tally) if (!best || count > best.count) best = { id, count };
  return best;
}

function dayLeaders(event: MatchDayEvent) {
  const goals = event.games.flatMap((g) => g.goals);
  return {
    scorer: leader(goals.filter((g) => !g.ownGoal).map((g) => g.playerId)),
    assister: leader(goals.flatMap((g) => (g.assistPlayerId != null ? [g.assistPlayerId] : []))),
    keeper: leader(event.games.flatMap((g) => (g.saves ?? []).map((s) => s.playerId))),
  };
}

function resultTone(a: number, b: number) {
  return a > b ? colors.win : a < b ? colors.paperDim : colors.draw;
}

// ---- Season strip ------------------------------------------------------------

function SeasonStrip({ events }: { events: MatchDayEvent[] }) {
  const games = events.reduce((n, e) => n + e.games.length, 0);
  const goals = events.reduce((n, e) => n + eventGoals(e), 0);
  const figures: [string, string | number][] = [
    ["Match days", events.length],
    ["Games", games],
    ["Goals", goals],
    ["Per game", games ? (goals / games).toFixed(1) : "–"],
  ];
  return (
    <Reveal>
      <View style={[styles.season, shadow.card]}>
        <LinearGradient colors={["#1b2540", colors.inkDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trim} />
        {figures.map(([label, value], i) => (
          <View key={label} style={[styles.seasonFigure, i > 0 ? styles.ruleLeft : null]}>
            <Txt style={[styles.seasonValue, i === 3 ? { color: colors.goldBright } : null]}>{value}</Txt>
            <Txt style={styles.figureLabel}>{label}</Txt>
          </View>
        ))}
      </View>
    </Reveal>
  );
}

// ---- Live banner -------------------------------------------------------------

function LiveBanner({ event }: { event: MatchDayEvent }) {
  const game = event.games.find((g) => g.status === "live") ?? event.games.at(-1);
  return (
    <Reveal>
      <Tilt onPress={() => router.push(`/match/${event.id}`)} accessibilityLabel={`${event.title} is live. Open the match sheet`} style={[styles.live, shadow.glow(colors.loss)]} max={5}>
        <LinearGradient colors={["rgba(194,59,107,0.4)", "rgba(19,26,43,0.95)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <PulseRing rounded={radius.xl} />
        <View style={styles.liveTop}>
          <LiveTag />
          <Txt style={[text.small, styles.flex]} numberOfLines={1}>
            {[event.title, event.venue].filter(Boolean).join(" · ")}
          </Txt>
          <Txt style={styles.liveGame}>GAME {event.games.length || 1}</Txt>
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
        <View style={styles.liveFoot}>
          <Txt style={text.small}>{plural(eventParticipants(event), "player")} here</Txt>
          <View style={styles.liveFollow}>
            <Txt style={styles.liveFollowText}>Follow live</Txt>
            <Ionicons name="arrow-forward" size={14} color={colors.paper} />
          </View>
        </View>
      </Tilt>
    </Reveal>
  );
}

// ---- Date stub -----------------------------------------------------------------

function DateStub({ event, gold }: { event: MatchDayEvent; gold?: boolean }) {
  const { day, month, weekday } = dateParts(event);
  const inner = (
    <>
      <Txt style={[styles.stubWeekday, gold ? styles.onGoldDim : null]}>{weekday}</Txt>
      <Txt style={[styles.stubDay, gold ? styles.onGold : null]}>{day}</Txt>
      <Txt style={[styles.stubMonth, gold ? styles.onGold : null]}>{month}</Txt>
    </>
  );
  if (gold) {
    return (
      <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stub}>
        {inner}
      </LinearGradient>
    );
  }
  return <View style={[styles.stub, styles.stubPlain, event.status === "live" ? styles.stubLive : null]}>{inner}</View>;
}

// ---- Compact card (All) ------------------------------------------------------

function FixtureCard({ event, index, latest }: { event: MatchDayEvent; index: number; latest: boolean }) {
  const live = event.status === "live";
  const goals = eventGoals(event);
  return (
    <Reveal index={index}>
      <Tilt onPress={() => router.push(`/match/${event.id}`)} accessibilityLabel={`${event.title}, ${event.date}. ${plural(event.games.length, "game")}`} style={styles.cardWrap} max={5}>
        <Glass style={styles.card}>
          {live ? <LinearGradient colors={["rgba(194,59,107,0.28)", "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
          {live ? <PulseRing /> : null}
          <DateStub event={event} gold={latest && !live} />
          <View style={styles.flex}>
            <View style={styles.titleLine}>
              <Txt style={styles.title} numberOfLines={1}>
                {event.title}
              </Txt>
              {live ? <LiveTag /> : latest ? <Txt style={styles.latestTag}>LATEST</Txt> : null}
            </View>
            {event.venue ? (
              <View style={styles.venue}>
                <Ionicons name="location" size={12} color={colors.mist} />
                <Txt style={[text.small, styles.flex]} numberOfLines={1}>
                  {event.venue}
                </Txt>
              </View>
            ) : null}
            {event.games.length > 0 ? (
              <View style={styles.chips}>
                {event.games.map((g) => {
                  const [a, b] = [scoreOf(g, 0), scoreOf(g, 1)];
                  const gameLive = g.status === "live";
                  return (
                    <View key={g.id} style={[styles.chip, { borderBottomColor: gameLive ? colors.loss : a === b ? colors.draw : colors.win }]}>
                      <Txt style={styles.chipText}>
                        {a}–{b}
                      </Txt>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Txt style={[text.small, styles.summary]}>No games yet</Txt>
            )}
            <View style={styles.meta}>
              <MetaItem icon="swap-horizontal" label={plural(event.games.length, "game")} />
              <MetaItem icon="football-outline" label={plural(goals, "goal")} />
              <MetaItem icon="people-outline" label={String(eventParticipants(event))} />
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mist} style={styles.chevron} />
        </Glass>
      </Tilt>
    </Reveal>
  );
}

function MetaItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={colors.mist} />
      <Txt style={text.small}>{label}</Txt>
    </View>
  );
}

// ---- Detailed card (Results) -------------------------------------------------

function GameDetail({ game, number, event, players }: { game: MatchDayGame; number: number; event: MatchDayEvent; players: Player[] }) {
  const [a, b] = [scoreOf(game, 0), scoreOf(game, 1)];
  const name = (id: ParticipantId) => participantName(players, event.guests, id);
  const live = game.status === "live";
  const outcome = live ? "In play" : a === b ? "Draw" : `${game.teams[a > b ? 0 : 1].name} win`;

  const side = (t: 0 | 1) => (
    <View style={[styles.side, t === 1 ? styles.sideRight : null]}>
      {[...game.goals]
        .filter((g) => g.teamIndex === t)
        .sort((x, y) => x.minute - y.minute)
        .map((g) => (
          <View key={g.id} style={[styles.event, t === 1 ? styles.eventRight : null]}>
            <Ionicons name="football" size={11} color={g.ownGoal ? colors.loss : colors.paperDim} />
            <Txt style={styles.eventText} numberOfLines={1}>
              {name(g.playerId).split(" ")[0]}
              {g.ownGoal ? " (og)" : ""} <Txt style={styles.minute}>{g.minute}′</Txt>
            </Txt>
          </View>
        ))}
      {game.cards
        .filter((c) => c.teamIndex === t)
        .map((c) => (
          <View key={c.id} style={[styles.event, t === 1 ? styles.eventRight : null]}>
            <RefCard type={c.type} />
            <Txt style={styles.eventText} numberOfLines={1}>
              {name(c.playerId).split(" ")[0]} <Txt style={styles.minute}>{c.minute}′</Txt>
            </Txt>
          </View>
        ))}
      {(game.saves ?? []).some((s) => s.teamIndex === t) ? (
        <View style={[styles.event, t === 1 ? styles.eventRight : null]}>
          <Ionicons name="hand-left-outline" size={11} color={colors.travel} />
          <Txt style={styles.eventText}>
            {plural((game.saves ?? []).filter((s) => s.teamIndex === t).length, "save")}
            {(game.saves ?? []).some((s) => s.teamIndex === t && s.penalty)
              ? ` · ${(game.saves ?? []).filter((s) => s.teamIndex === t && s.penalty).length} pen`
              : ""}
          </Txt>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.game}>
      <View style={styles.gameHead}>
        <Txt style={[styles.gameNo, live ? { color: colors.loss } : null]}>GAME {number}</Txt>
        <Txt style={[styles.outcome, { color: live ? colors.loss : a === b ? colors.draw : colors.win }]} numberOfLines={1}>
          {outcome}
        </Txt>
      </View>
      <View style={styles.gameScore}>
        <Txt style={[styles.gameTeam, a < b && !live ? styles.dim : null]} numberOfLines={2}>
          {game.teams[0].name}
        </Txt>
        <View style={[styles.digits, live ? styles.digitsLive : null]}>
          <Txt style={[styles.digit, { color: live ? colors.paper : resultTone(a, b) }]}>{a}</Txt>
          <View style={styles.digitRule} />
          <Txt style={[styles.digit, { color: live ? colors.paper : resultTone(b, a) }]}>{b}</Txt>
        </View>
        <Txt style={[styles.gameTeam, styles.right, b < a && !live ? styles.dim : null]} numberOfLines={2}>
          {game.teams[1].name}
        </Txt>
      </View>
      {game.goals.length || game.cards.length || game.saves?.length ? (
        <View style={styles.sides}>
          {side(0)}
          <View style={styles.sideDivider} />
          {side(1)}
        </View>
      ) : (
        <Txt style={[text.small, styles.center]}>Goalless — no events logged</Txt>
      )}
    </View>
  );
}

function Award({ label, icon, tone, who, unit, event, players }: { label: string; icon: keyof typeof Ionicons.glyphMap; tone: string; who: Leader; unit: string; event: MatchDayEvent; players: Player[] }) {
  const player = typeof who.id === "number" ? players.find((p) => p.id === who.id) : undefined;
  return (
    <View style={styles.award}>
      <View style={styles.awardTop}>
        <Ionicons name={icon} size={11} color={tone} />
        <Txt style={[styles.awardLabel, { color: tone }]}>{label}</Txt>
      </View>
      <View style={styles.awardWho}>
        {player ? <Avatar player={player} size={28} ring={tone} /> : null}
        <View style={styles.flex}>
          <Txt style={styles.awardName} numberOfLines={1}>
            {participantName(players, event.guests, who.id).split(" ")[0]}
          </Txt>
          <Txt style={styles.awardCount}>{plural(who.count, unit)}</Txt>
        </View>
      </View>
    </View>
  );
}

function ResultCard({ event, index, players }: { event: MatchDayEvent; index: number; players: Player[] }) {
  const leaders = useMemo(() => dayLeaders(event), [event]);
  const cards = event.games.reduce((n, g) => n + g.cards.length, 0);
  const figures: [string, number][] = [
    ["Games", event.games.length],
    ["Goals", eventGoals(event)],
    ["Players", eventParticipants(event)],
    ["Cards", cards],
  ];
  const awards = [
    leaders.scorer && { key: "s", label: "Top scorer", icon: "football" as const, tone: colors.goldBright, who: leaders.scorer, unit: "goal" },
    leaders.assister && { key: "a", label: "Playmaker", icon: "flash" as const, tone: colors.win, who: leaders.assister, unit: "assist" },
    leaders.keeper && { key: "k", label: "Wall", icon: "hand-left" as const, tone: colors.travel, who: leaders.keeper, unit: "save" },
  ].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <Reveal index={index}>
      <View style={[styles.result, shadow.card]}>
        <LinearGradient colors={["#1b2540", "#0f1527", colors.inkDeep]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={foil} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.trim} />
        <Txt style={styles.watermark} numberOfLines={1} accessible={false}>
          FT
        </Txt>

        <View style={styles.resultHead}>
          <DateStub event={event} gold />
          <View style={styles.flex}>
            <Txt style={styles.fullTime}>FULL TIME</Txt>
            <Txt style={styles.resultTitle} numberOfLines={2}>
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
            <View key={label} style={[styles.figure, i > 0 ? styles.ruleLeft : null]}>
              <Txt style={styles.figureValue}>{value}</Txt>
              <Txt style={styles.figureLabel}>{label}</Txt>
            </View>
          ))}
        </View>

        <View style={styles.games}>
          {event.games.length === 0 ? <Txt style={[text.small, styles.center]}>No games were played.</Txt> : event.games.map((g, i) => <GameDetail key={g.id} game={g} number={i + 1} event={event} players={players} />)}
        </View>

        {awards.length ? (
          <View style={styles.awards}>
            {awards.map((aw) => (
              <Award key={aw.key} label={aw.label} icon={aw.icon} tone={aw.tone} who={aw.who} unit={aw.unit} event={event} players={players} />
            ))}
          </View>
        ) : null}

        <Tilt onPress={() => router.push(`/match/${event.id}`)} accessibilityLabel={`Open the full match sheet for ${event.title}`} style={styles.sheetLink} max={3}>
          <Txt style={styles.sheetLinkText}>Full match sheet</Txt>
          <Ionicons name="arrow-forward" size={14} color={colors.ink} />
        </Tilt>
      </View>
    </Reveal>
  );
}

// ---- Screen ----------------------------------------------------------------

export default function MatchesScreen() {
  const { events, players, loading, error, refresh } = useClub();
  const [filter, setFilter] = useState<Filter>("all");

  const sorted = sortEvents(events);
  const liveEvents = sorted.filter((e) => e.status === "live");
  const visible = sorted.filter((e) => filter === "all" || e.status === filter);
  const latestEnded = sorted.find((e) => e.status === "ended");
  const groups = byMonth(filter === "all" ? visible.filter((e) => e.status !== "live") : visible);
  let n = 0;

  return (
    <Screen onRefresh={refresh} topInset>
      <PageTitle eyebrow="The fixture book" title="Matches" />
      <ErrorBanner message={error} onRetry={refresh} />

      {sorted.length > 0 ? <SeasonStrip events={sorted} /> : null}

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All" },
          { value: "ended", label: "Results" },
          { value: "live", label: liveEvents.length ? `Live (${liveEvents.length})` : "Live" },
        ]}
      />

      {loading && events.length === 0 ? (
        <Loading label="Loading match days…" />
      ) : filter === "live" ? (
        liveEvents.length === 0 ? (
          <Empty icon="radio-outline">Nothing is being played right now.</Empty>
        ) : (
          liveEvents.map((e) => <LiveBanner key={e.id} event={e} />)
        )
      ) : visible.length === 0 ? (
        <Empty icon="football-outline">{filter === "ended" ? "No results yet. Finished match days land here." : "No match days yet. They'll show up here once the committee starts one."}</Empty>
      ) : (
        <>
          {filter === "all" ? liveEvents.map((e) => <LiveBanner key={e.id} event={e} />) : null}
          {groups.map((group) => (
            <View key={group.label}>
              <View style={styles.month}>
                <Txt style={styles.monthText}>{group.label}</Txt>
                <View style={styles.monthRule} />
                <Txt style={text.small}>{plural(group.events.length, "match day")}</Txt>
              </View>
              {group.events.map((e) =>
                filter === "ended" ? (
                  <ResultCard key={e.id} event={e} index={n++} players={players} />
                ) : (
                  <FixtureCard key={e.id} event={e} index={n++} latest={e === latestEnded} />
                ),
              )}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  dim: { color: colors.paperDim },
  trim: { position: "absolute", top: 0, left: 0, right: 0, height: 3 },
  ruleLeft: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: glass.edgeBright },

  // Season strip
  season: { flexDirection: "row", borderRadius: radius.lg, overflow: "hidden", paddingVertical: space.lg, marginBottom: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  seasonFigure: { flex: 1, alignItems: "center" },
  seasonValue: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 32, color: colors.paper, fontVariant: ["tabular-nums"] },
  figureLabel: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.1, color: colors.mist, textTransform: "uppercase", marginTop: 2 },

  // Month header
  month: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, marginBottom: space.md },
  monthText: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 1, color: colors.goldBright, textTransform: "uppercase" },
  monthRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(212,169,58,0.35)" },

  // Live
  live: { borderRadius: radius.xl, padding: space.lg, marginTop: space.md, marginBottom: space.md, overflow: "hidden", backgroundColor: colors.inkRaised },
  liveTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  liveGame: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2, color: colors.paperDim },
  liveScore: { flexDirection: "row", alignItems: "center", gap: space.md, marginVertical: space.lg },
  liveTeam: { flex: 1, fontFamily: fonts.display, fontSize: 20, lineHeight: 22, color: colors.paper },
  liveDigits: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveDigit: { fontFamily: fonts.displayHeavy, fontSize: 60, lineHeight: 64, color: colors.paper, fontVariant: ["tabular-nums"], textShadowColor: "rgba(255,111,159,0.6)", textShadowRadius: 18 },
  liveColon: { fontFamily: fonts.displayHeavy, fontSize: 40, color: "rgba(246,246,243,0.35)" },
  liveWait: { marginVertical: space.lg, textAlign: "center" },
  liveFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  liveFollow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.loss, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 34 },
  liveFollowText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.paper },

  // Date stub
  stub: { width: 62, height: 76, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  stubPlain: { backgroundColor: "rgba(5,7,15,0.55)", borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  stubLive: { borderColor: "rgba(194,59,107,0.7)" },
  stubWeekday: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.3, color: colors.mist },
  stubDay: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 34, color: colors.paper },
  stubMonth: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, color: colors.mist },
  onGold: { color: colors.ink },
  onGoldDim: { color: "rgba(10,14,26,0.65)" },

  // Compact card
  cardWrap: { marginBottom: space.md },
  card: { flexDirection: "row", gap: space.lg, padding: space.lg, alignItems: "flex-start" },
  titleLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 23, color: colors.paper, flexShrink: 1 },
  latestTag: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.3, color: colors.goldBright, backgroundColor: "rgba(212,169,58,0.14)", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, overflow: "hidden" },
  venue: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { backgroundColor: "rgba(5,7,15,0.55)", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, borderBottomWidth: 2 },
  chipText: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.paper, fontVariant: ["tabular-nums"] },
  summary: { marginTop: 10 },
  meta: { flexDirection: "row", gap: space.md, marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  chevron: { alignSelf: "center", marginRight: -4 },

  // Result card
  result: { borderRadius: radius.xl, overflow: "hidden", marginBottom: space.lg, backgroundColor: colors.inkRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright, paddingBottom: space.lg },
  watermark: { position: "absolute", top: -6, right: 10, fontFamily: fonts.displayHeavy, fontSize: 110, lineHeight: 116, color: "rgba(255,255,255,0.04)" },
  resultHead: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: space.lg, paddingTop: space.lg + 3 },
  fullTime: { alignSelf: "flex-start", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.6, color: colors.goldBright, backgroundColor: "rgba(212,169,58,0.14)", borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, overflow: "hidden" },
  resultTitle: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 27, color: colors.paper, marginTop: 6 },
  figures: { flexDirection: "row", marginTop: space.lg, marginHorizontal: space.lg, backgroundColor: "rgba(5,7,15,0.45)", borderRadius: radius.md, paddingVertical: space.md },
  figure: { flex: 1, alignItems: "center" },
  figureValue: { fontFamily: fonts.displayHeavy, fontSize: 24, lineHeight: 26, color: colors.paper, fontVariant: ["tabular-nums"] },

  games: { paddingHorizontal: space.lg, gap: space.md, marginTop: space.lg },
  game: { backgroundColor: glass.raised, borderRadius: radius.md, padding: space.md, gap: space.sm },
  gameHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  gameNo: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.3, color: colors.mist },
  outcome: { fontFamily: fonts.bodySemi, fontSize: 11, flexShrink: 1 },
  gameScore: { flexDirection: "row", alignItems: "center", gap: space.sm },
  gameTeam: { flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: colors.paper },
  digits: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.inkDeep, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  digitsLive: { borderColor: colors.loss },
  digit: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 30, fontVariant: ["tabular-nums"], minWidth: 14, textAlign: "center" },
  digitRule: { width: 1, height: 18, backgroundColor: "rgba(255,255,255,0.18)" },
  sides: { flexDirection: "row", gap: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.07)" },
  side: { flex: 1, minWidth: 0, gap: 4 },
  sideRight: { alignItems: "flex-end" },
  sideDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.07)" },
  event: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%" },
  eventRight: { flexDirection: "row-reverse" },
  eventText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.paperDim, flexShrink: 1 },
  minute: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.mist },

  awards: { flexDirection: "row", gap: space.sm, paddingHorizontal: space.lg, marginTop: space.lg },
  award: { flex: 1, minWidth: 0, backgroundColor: "rgba(5,7,15,0.45)", borderRadius: radius.md, padding: space.sm + 2, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  awardTop: { flexDirection: "row", alignItems: "center", gap: 4 },
  awardLabel: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
  awardWho: { flexDirection: "row", alignItems: "center", gap: 6 },
  awardName: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper },
  awardCount: { fontFamily: fonts.body, fontSize: 11, color: colors.mist },

  sheetLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch", backgroundColor: colors.paper, borderRadius: radius.pill, marginHorizontal: space.lg, marginTop: space.lg, minHeight: 44 },
  sheetLinkText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
});
