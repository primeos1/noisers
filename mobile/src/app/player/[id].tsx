import { useState } from "react";
import { Pressable, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveMediaUrl } from "../../lib/config";
import { absenceLabel, currentAbsence, returnHint } from "../../lib/absences";
import { Backdrop, haptic, useParallax } from "../../components/depth";
import { HoloCard, stockPhoto } from "../../components/PlayerCard";
import { useClub } from "../../lib/club";
import { useAuth } from "../../lib/auth";
import { cardCounts, cardDate, formatNaira, isKeeper, playerGameLog, plural, positionLabel } from "../../lib/derive";
import {
  CardPips,
  Empty,
  Figures,
  Group,
  Loading,
  Pill,
  RatingMeter,
  RefCard,
  ResultChip,
  Row,
  Screen,
  Segmented,
  Txt,
  text,
  MembershipBadge,
} from "../../components/ui";
import { colors, fonts, glass, radius, space } from "../../theme";

const HERO = 560;

type Tab = "overview" | "games" | "form" | "fines";

function Line({ label, value, tone = colors.paper }: { label: string; value: string | number; tone?: string }) {
  return (
    <Row>
      <Txt style={[text.dim, styles.flex]}>{label}</Txt>
      <Txt style={[text.semi, text.tabular, { color: tone }]}>{value}</Txt>
    </Row>
  );
}

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, cards, events, absences, loading, refresh, myShirt, setMyShirt } = useClub();
  const { status } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.62, 260);
  const { onScroll, heroStyle, fadeStyle } = useParallax(HERO);

  const playerId = Number(id);
  const player = players.find((p) => p.id === playerId);

  if (!player) {
    return (
      <Screen onRefresh={refresh} topInset="header">
        {loading ? <Loading label="Loading player…" /> : <Empty>{"We couldn't find that player. Pick someone from the Squad tab."}</Empty>}
      </Screen>
    );
  }

  const log = playerGameLog(events, playerId);
  const finished = log.filter((g) => g.result !== null);
  const record = {
    W: finished.filter((g) => g.result === "W").length,
    D: finished.filter((g) => g.result === "D").length,
    L: finished.filter((g) => g.result === "L").length,
  };
  const fines = cardCounts(cards, playerId);
  const contributions = player.goals + player.assists;
  const isMe = myShirt === playerId;
  // Your own profile, or anyone's for the committee.
  const canEdit = isMe || status === "signedIn";
  const form = finished.slice(0, 10);
  const firstName = player.name.split(" ")[0];

  const backRows = [
    { label: "Won", value: String(record.W), tone: colors.win },
    { label: "Drawn", value: String(record.D), tone: colors.draw },
    { label: "Lost", value: String(record.L), tone: colors.loss },
    { label: "Win rate", value: finished.length ? `${Math.round((record.W / finished.length) * 100)}%` : "–", tone: colors.paper },
    { label: "Fines owed", value: formatNaira(fines.outstanding), tone: fines.outstanding ? colors.loss : colors.win },
  ];

  const matchDays = [...new Map(log.map((g) => [g.event.id, g.event])).values()].map((event) => {
    const games = log.filter((g) => g.event.id === event.id).sort((a, b) => a.gameNumber - b.gameNumber);
    return {
      event,
      games,
      goals: games.reduce((s, g) => s + g.goals, 0),
      assists: games.reduce((s, g) => s + g.assists, 0),
    };
  });

  const out = currentAbsence(absences, playerId);
  const outLabel = out ? absenceLabel(out.type) : null;

  return (
    <View style={styles.root}>
      <Backdrop />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.paper} />}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 56 }]}>
          <Animated.View style={[styles.heroBg, heroStyle]}>
            <Image source={{ uri: resolveMediaUrl(player.photoUrl) ?? stockPhoto(player.id) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={28} />
            <LinearGradient colors={["rgba(10,14,26,0.35)", "rgba(10,14,26,0.7)", colors.ink]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={fadeStyle}>
            <HoloCard
              player={player}
              width={cardWidth}
              back={
                <View style={styles.back}>
                  <Txt style={[text.eyebrow, styles.center]}>Record</Txt>
                  {backRows.map((r) => (
                    <View key={r.label} style={styles.backRow}>
                      <Txt style={text.dim}>{r.label}</Txt>
                      <Txt style={[styles.backValue, { color: r.tone }]}>{r.value}</Txt>
                    </View>
                  ))}
                </View>
              }
            />
          </Animated.View>
          <Txt style={styles.name} accessibilityRole="header">
            {player.name}
          </Txt>
          <Txt style={[text.dim, styles.center]}>
            {positionLabel[player.position]}
            {player.secondaryPosition ? ` / ${positionLabel[player.secondaryPosition]}` : ""} · #{player.number}
          </Txt>
          <View style={styles.badges}>
            <MembershipBadge membership={player.membership ?? "member"} />
            {outLabel && out ? <Pill label={`${outLabel.short} · ${returnHint(out)}`} tone={outLabel.tone} icon={outLabel.icon} /> : null}
          </View>
          <Txt style={[text.small, styles.center]}>Drag the card to turn it · tap to flip</Txt>
          <View style={styles.heroActions}>
            {canEdit ? (
              <Pressable onPress={() => router.push({ pathname: "/profile", params: { id: String(playerId) } })} accessibilityRole="button" style={styles.meButton}>
                <Ionicons name="create-outline" size={15} color={colors.paperDim} />
                <Txt style={[text.semi, styles.meText]}>Edit profile</Txt>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                haptic.success();
                setMyShirt(isMe ? null : playerId);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: isMe }}
              style={[styles.meButton, isMe ? styles.meButtonActive : null]}
            >
              <Ionicons name={isMe ? "star" : "star-outline"} size={15} color={isMe ? colors.ink : colors.paperDim} />
              <Txt style={[text.semi, styles.meText, isMe ? styles.meTextActive : null]}>{isMe ? "This is you" : "This is me"}</Txt>
            </Pressable>
          </View>
          {player.bio ? <Txt style={[text.dim, styles.bio]}>{player.bio}</Txt> : null}
        </View>

        <View style={styles.body}>
        <View style={styles.ratingCard}>
          <View style={styles.ratingTop}>
            <Txt style={text.eyebrow}>Rating</Txt>
            <Txt style={styles.rating}>{player.rating.toFixed(2)}</Txt>
          </View>
          <RatingMeter rating={player.rating} />
          <View style={styles.formRow}>
            {form.length ? form.slice(0, 5).map((g) => <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} />) : <Txt style={text.small}>No results yet</Txt>}
          </View>
        </View>

      <Figures
        items={[
          { label: "Games", value: player.appearances },
          { label: "Goals", value: player.goals, tone: colors.win },
          { label: "Assists", value: player.assists },
          // Forwards don't keep clean sheets.
          ...(player.position === "FWD" ? [] : [{ label: "Clean sheets", value: player.cleanSheets }]),
          ...(isKeeper(player) ? [{ label: "Saves", value: player.saves ?? 0 }] : []),
        ]}
      />

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "Overview" },
          { value: "games", label: "Games" },
          { value: "form", label: "Form" },
          { value: "fines", label: "Fines" },
        ]}
      />

      {tab === "overview" ? (
        <>
          <Group title="Honours">
            <Line label="Player of the week" value={plural(player.playerOfTheWeekWins ?? 0, "time")} tone={colors.goldBright} />
            <Line label="Team of the week" value={plural(player.teamOfTheWeekSelections ?? 0, "time")} tone={colors.goldBright} />
          </Group>
          <Group title="Scoring">
            <Line label="Goals" value={player.goals} tone={colors.win} />
            <Line label="Assists" value={player.assists} />
            <Line label="Goals plus assists per game" value={player.appearances ? (contributions / player.appearances).toFixed(2) : "–"} />
          </Group>
          <Group title="Results">
            <Line label="Won" value={record.W} tone={colors.win} />
            <Line label="Drawn" value={record.D} tone={colors.draw} />
            <Line label="Lost" value={record.L} tone={colors.loss} />
          </Group>
          <Group title="Discipline">
            <Row>
              <Txt style={[text.dim, styles.flex]}>Cards</Txt>
              {fines.unpaid.length ? <CardPips yellow={fines.unpaidYellow} red={fines.unpaidRed} /> : <Txt style={text.semi}>None</Txt>}
            </Row>
            <Line label="Fines owed" value={formatNaira(fines.outstanding)} tone={fines.outstanding ? colors.loss : colors.win} />
          </Group>
        </>
      ) : null}

      {tab === "games" ? (
        matchDays.length === 0 ? (
          <Empty>{`${firstName} hasn't played a match day yet.`}</Empty>
        ) : (
          matchDays.map((m) => (
            <Group
              key={m.event.id}
              title={m.event.title}
              aside={
                m.goals || m.assists
                  ? [m.goals ? plural(m.goals, "goal") : "", m.assists ? plural(m.assists, "assist") : ""].filter(Boolean).join(", ")
                  : m.event.date
              }
            >
              {m.games.map((g) => (
                <Row key={g.game.id} onPress={() => router.push(`/match/${g.event.id}`)}>
                  <ResultChip result={g.result} />
                  <View style={styles.flex}>
                    <Txt style={text.body} numberOfLines={1}>
                      {g.teamName}{" "}
                      <Txt style={styles.gameScore}>
                        {g.goalsFor}–{g.goalsAgainst}
                      </Txt>
                    </Txt>
                    <Txt style={text.small}>Game {g.gameNumber}</Txt>
                  </View>
                  <CardPips yellow={g.yellows} red={g.reds} />
                  {g.goals > 0 || g.assists > 0 ? (
                    <Txt style={text.semi}>
                      {g.goals > 0 ? <Txt style={[text.semi, { color: colors.win }]}>{g.goals}G </Txt> : null}
                      {g.assists > 0 ? `${g.assists}A` : null}
                    </Txt>
                  ) : null}
                </Row>
              ))}
            </Group>
          ))
        )
      ) : null}

      {tab === "form" ? (
        form.length === 0 ? (
          <Empty>No finished games yet, so there's no form to show.</Empty>
        ) : (
          <>
            <View style={styles.formCard}>
              <Txt style={text.dim}>Last {form.length} games, newest first</Txt>
              <View style={styles.formGrid}>
                {form.map((g) => (
                  <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} size="lg" />
                ))}
              </View>
            </View>
            <Figures
              items={[
                { label: "Won", value: record.W, tone: colors.win },
                { label: "Drawn", value: record.D, tone: colors.draw },
                { label: "Lost", value: record.L, tone: colors.loss },
                { label: "Win rate", value: `${Math.round((record.W / finished.length) * 100)}%` },
              ]}
            />
          </>
        )
      ) : null}

      {tab === "fines" ? (
        <>
          <Figures
            items={[
              { label: "Owed", value: formatNaira(fines.outstanding), tone: fines.outstanding ? colors.loss : colors.paper },
              { label: "Paid", value: formatNaira(fines.paid), tone: colors.win },
            ]}
          />
          {fines.unpaid.length === 0 ? (
            <Empty>{fines.cards.length ? "All fines paid. Slate's clean." : "No cards, no fines. Keep it that way."}</Empty>
          ) : (
            <Group title="Cards">
              {fines.unpaid.map((c) => (
                <Row key={c.id}>
                  <RefCard type={c.type} size="md" />
                  <View style={styles.flex}>
                    <Txt style={text.body} numberOfLines={1}>
                      {c.reason || `${c.type === "red" ? "Red" : "Yellow"} card`}
                    </Txt>
                    <Txt style={text.small}>{cardDate(c)}</Txt>
                  </View>
                  <View style={styles.alignRight}>
                    <Txt style={[text.semi, text.tabular]}>{formatNaira(c.fineAmount)}</Txt>
                    <Txt style={[text.small, { color: c.paid ? colors.win : colors.loss }]}>{c.paid ? "Paid" : "Not paid"}</Txt>
                  </View>
                </Row>
              ))}
            </Group>
          )}
        </>
      ) : null}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { paddingBottom: 64 },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: "center" },
  alignRight: { alignItems: "flex-end" },
  hero: { alignItems: "center", paddingHorizontal: space.lg, paddingBottom: space.xl },
  heroBg: { position: "absolute", top: 0, left: 0, right: 0, height: HERO },
  name: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, color: colors.paper, textAlign: "center", marginTop: space.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginVertical: space.md },
  heroActions: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  bio: { marginTop: space.lg, textAlign: "center", lineHeight: 20 },
  back: { gap: 9 },
  backRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  backValue: { fontFamily: fonts.display, fontSize: 20 },
  body: { paddingHorizontal: space.lg },
  ratingCard: { backgroundColor: glass.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, padding: space.lg, marginBottom: space.xl, gap: space.md },
  ratingTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  rating: { fontFamily: fonts.displayHeavy, fontSize: 48, lineHeight: 50, color: colors.goldBright, fontVariant: ["tabular-nums"] },
  formRow: { flexDirection: "row", gap: 6 },
  meButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: glass.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  meButtonActive: { backgroundColor: colors.goldBright, borderColor: colors.goldBright },
  meText: { fontSize: 13, color: colors.paperDim },
  meTextActive: { color: colors.ink },
  gameScore: { fontFamily: fonts.display, fontSize: 18, color: colors.paper },
  formCard: { backgroundColor: glass.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, padding: space.lg, marginBottom: space.xl },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
});
