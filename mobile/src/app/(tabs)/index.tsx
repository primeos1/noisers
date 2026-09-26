import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import {
  cardCounts,
  formatNaira,
  playerGameLog,
  plural,
  positionGroupLabel,
  positions,
  scoreOf,
  sortEvents,
} from "../../lib/derive";
import type { Player } from "../../lib/types";
import {
  Avatar,
  CardPips,
  Empty,
  ErrorBanner,
  Group,
  LiveTag,
  Loading,
  RatingMeter,
  ResultChip,
  Row,
  Screen,
  Txt,
  text,
  MembershipBadge,
} from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

const logo = require("../../../assets/brand/crest.png");

function MyShirt({ player }: { player: Player }) {
  const { cards, events, setMyShirt } = useClub();
  const fines = cardCounts(cards, player.id);
  const form = playerGameLog(events, player.id)
    .filter((g) => g.result)
    .slice(0, 5);

  return (
    <View style={styles.mine}>
      <View style={styles.mineTop}>
        <Avatar player={player} size={96} rounded={radius.md} />
        <View style={styles.flex}>
          <Txt style={text.small}>Your shirt</Txt>
          <Txt style={[text.display, styles.mineName]} numberOfLines={1}>
            {player.name}
          </Txt>
          <View style={styles.ratingLine}>
            <Txt style={styles.mineRating}>{player.rating.toFixed(2)}</Txt>
            <Txt style={text.small}>rating</Txt>
          </View>
          <RatingMeter rating={player.rating} />
        </View>
      </View>
      <View style={styles.mineStrip}>
        <View style={styles.formRow}>
          {form.length ? (
            form.map((g) => <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} />)
          ) : (
            <Txt style={text.small}>No results yet</Txt>
          )}
        </View>
        <Txt style={[text.semi, styles.fineText, { color: fines.outstanding ? colors.loss : colors.win }]}>
          {fines.outstanding ? `${formatNaira(fines.outstanding)} owed` : "No fines owed"}
        </Txt>
      </View>
      <View style={styles.mineActions}>
        <Pressable
          style={({ pressed }) => [styles.mineAction, pressed ? styles.pressed : null]}
          onPress={() => router.push(`/player/${player.id}`)}
          accessibilityRole="button"
        >
          <Txt style={text.semi}>Open my profile</Txt>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.mineAction, styles.mineActionRight, pressed ? styles.pressed : null]}
          onPress={() => setMyShirt(null)}
          accessibilityRole="button"
        >
          <Txt style={[text.semi, { color: colors.paperDim }]}>Not me</Txt>
        </Pressable>
      </View>
    </View>
  );
}

function PickShirt({ players, onPick }: { players: Player[]; onPick: (n: number) => void }) {
  const sorted = useMemo(() => [...players].sort((a, b) => a.number - b.number), [players]);
  return (
    <View style={styles.pick}>
      <Txt style={[text.display, styles.pickTitle]}>Which shirt is yours?</Txt>
      <Txt style={[text.dim, styles.pickBody]}>
        Tap your number to put your rating, form and fines at the top. It's only saved on this phone.
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
        {sorted.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, number ${p.number}`}
            style={({ pressed }) => [styles.shirtButton, pressed ? styles.shirtButtonPressed : null]}
          >
            <Txt style={[text.display, styles.shirtNumber]}>{p.number}</Txt>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function SquadScreen() {
  const { players, cards, events, loading, error, refresh, myShirt, setMyShirt } = useClub();
  const [query, setQuery] = useState("");

  const me = players.find((p) => p.id === myShirt);
  const latest = sortEvents(events)[0];

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => players.filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.number).includes(q)),
    [players, q],
  );

  return (
    <Screen onRefresh={refresh} topInset>
      <View style={styles.brand}>
        <Image source={logo} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors />
        <Txt style={[text.heavy, styles.brandText]}>Noisers</Txt>
      </View>

      <ErrorBanner message={error} onRetry={refresh} />

      {me ? <MyShirt player={me} /> : players.length > 0 ? <PickShirt players={players} onPick={setMyShirt} /> : null}

      {latest ? (
        <Group
          title="Latest match day"
          aside={latest.status === "live" ? <LiveTag /> : latest.date}
        >
          <Row onPress={() => router.push(`/match/${latest.id}`)}>
            <View style={styles.flex}>
              <Txt style={[text.display, styles.latestTitle]} numberOfLines={1}>
                {latest.title}
              </Txt>
              <View style={styles.scoreChips}>
                {latest.games.length === 0 ? (
                  <Txt style={text.small}>No games yet</Txt>
                ) : (
                  latest.games.map((g) => (
                    <View key={g.id} style={styles.scoreChip}>
                      <Txt style={styles.scoreChipText}>
                        {g.teams[0].name} {scoreOf(g, 0)}–{scoreOf(g, 1)} {g.teams[1].name}
                      </Txt>
                    </View>
                  ))
                )}
              </View>
            </View>
          </Row>
        </Group>
      ) : null}

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.mist} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find a player by name or number"
          placeholderTextColor={colors.mist}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Find a player"
        />
      </View>

      {loading && players.length === 0 ? (
        <Loading label="Loading the squad…" />
      ) : visible.length === 0 ? (
        <Empty>{q ? `No one matches "${query}". Try a surname or a shirt number.` : "No players in the squad yet."}</Empty>
      ) : (
        positions.map((pos) => {
          const group = visible.filter((p) => p.position === pos).sort((a, b) => a.number - b.number);
          if (group.length === 0) return null;
          return (
            <Group key={pos} title={positionGroupLabel[pos]} aside={group.length}>
              {group.map((p) => {
                const c = cardCounts(cards, p.id);
                return (
                  <Row key={p.id} onPress={() => router.push(`/player/${p.id}`)} accessibilityLabel={`${p.name}, number ${p.number}`}>
                    <Txt style={[text.heavy, styles.rowNumber]}>{p.number}</Txt>
                    <Avatar player={p} />
                    <View style={styles.flex}>
                      <View style={styles.nameLine}>
                        <Txt style={[text.semi, styles.shrink]} numberOfLines={1}>
                          {p.name}
                        </Txt>
                        {p.membership === "guest" ? <MembershipBadge membership="guest" /> : null}
                        {p.id === myShirt ? (
                          <View style={styles.youTag}>
                            <Txt style={styles.youText}>You</Txt>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.metaLine}>
                        <Txt style={text.small}>
                          {plural(p.appearances, "game")}, {plural(p.goals, "goal")}
                        </Txt>
                        <CardPips yellow={c.yellow} red={c.red} />
                      </View>
                    </View>
                    <Txt style={[text.display, styles.rowRating]}>{p.rating.toFixed(2)}</Txt>
                  </Row>
                );
              })}
            </Group>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  pressed: { backgroundColor: "rgba(38,47,69,0.5)" },

  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: space.lg + 4 },
  logo: { width: 34, height: 34 },
  brandText: { fontSize: 26 },

  mine: { backgroundColor: colors.inkRaised, borderRadius: radius.lg, marginBottom: space.xl, overflow: "hidden", borderWidth: 1, borderColor: "rgba(168,132,31,0.25)" },
  mineTop: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg, paddingBottom: space.md },
  mineName: { fontSize: 24, marginTop: 2 },
  ratingLine: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4, marginBottom: 6 },
  mineRating: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 36, color: colors.draw },
  mineStrip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },
  formRow: { flexDirection: "row", gap: 6 },
  fineText: { fontSize: 14 },
  mineActions: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },
  mineAction: { flex: 1, alignItems: "center", paddingVertical: 14 },
  mineActionRight: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.inkLine },

  pick: { backgroundColor: colors.inkRaised, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl },
  pickTitle: { fontSize: 24 },
  pickBody: { marginTop: 4, lineHeight: 20 },
  pickRow: { gap: space.sm, paddingTop: space.lg },
  shirtButton: { minWidth: 48, height: 48, borderRadius: 24, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.inkLine },
  shirtButtonPressed: { backgroundColor: colors.inkLine },
  shirtNumber: { fontSize: 20 },

  latestTitle: { fontSize: 20 },
  scoreChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  scoreChip: { backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  scoreChipText: { fontFamily: fonts.displaySemi, fontSize: 14, color: colors.paperDim, fontVariant: ["tabular-nums"] },

  search: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.inkRaised, borderRadius: radius.pill, paddingHorizontal: space.lg, marginBottom: space.xl },
  searchInput: { flex: 1, minHeight: 46, color: colors.paper, fontFamily: fonts.body, fontSize: 16 },

  rowNumber: { width: 34, textAlign: "right", fontSize: 26, color: colors.paperDim, fontVariant: ["tabular-nums"] },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  youTag: { backgroundColor: "rgba(246,246,243,0.1)", borderRadius: radius.pill, paddingHorizontal: 6 },
  youText: { fontSize: 10, color: colors.paperDim },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  rowRating: { fontSize: 22, color: colors.draw, fontVariant: ["tabular-nums"] },
});
