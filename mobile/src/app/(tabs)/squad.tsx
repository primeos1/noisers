import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { absenceLabel, currentAbsence } from "../../lib/absences";
import { cardCounts, plural, positionGroupLabel, positions } from "../../lib/derive";
import type { Absence, Player, Position } from "../../lib/types";
import { Avatar, CardPips, Chips, Empty, ErrorBanner, Group, Loading, MembershipBadge, PageTitle, Pill, Row, Screen, Txt, text } from "../../components/ui";
import { Reveal, Tilt, haptic } from "../../components/depth";
import { CardFace } from "../../components/PlayerCard";
import { colors, fonts, glass, radius, space } from "../../theme";

type Filter = "all" | Position | "out";
type Layout = "cards" | "list";

const GridCard = memo(function GridCard({ player, width, out, mine }: { player: Player; width: number; out: Absence | null; mine: boolean }) {
  const t = out ? absenceLabel(out.type) : null;
  return (
    <Tilt onPress={() => router.push(`/player/${player.id}`)} accessibilityLabel={`${player.name}, number ${player.number}, rated ${player.rating.toFixed(2)}${t ? `, ${t.short}` : ""}`}>
      <CardFace
        player={player}
        width={width}
        badge={
          t || mine ? (
            <View style={styles.badges}>
              {mine ? <Pill label="You" tone={colors.goldBright} icon="star" solid /> : null}
              {t ? <Pill label={t.short} tone={t.tone} icon={t.icon} solid /> : null}
            </View>
          ) : undefined
        }
      />
    </Tilt>
  );
});

export default function SquadScreen() {
  const { players, cards, absences, loading, error, refresh, myShirt } = useClub();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<Layout>("cards");

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      players
        .filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.number).includes(q))
        .filter((p) => (filter === "all" ? true : filter === "out" ? currentAbsence(absences, p.id)?.status === "active" : p.position === filter))
        .sort((a, b) => a.number - b.number),
    [players, q, filter, absences],
  );
  const outCount = useMemo(() => players.filter((p) => currentAbsence(absences, p.id)?.status === "active").length, [players, absences]);

  // Two cards a row on phones, more on tablets.
  const columns = width >= 700 ? 4 : 2;
  const cardWidth = Math.floor((Math.min(width, 1000) - space.lg * 2 - space.md * (columns - 1)) / columns);

  return (
    <Screen onRefresh={refresh} topInset>
      <PageTitle
        eyebrow="Noisers FC"
        title="Squad"
        sub={plural(players.length, "player")}
        right={
          <Pressable
            onPress={() => {
              haptic.tap();
              setLayout((l) => (l === "cards" ? "list" : "cards"));
            }}
            accessibilityRole="button"
            accessibilityLabel={layout === "cards" ? "Show as a list" : "Show as cards"}
            style={styles.layoutToggle}
          >
            <Ionicons name={layout === "cards" ? "list" : "grid"} size={18} color={colors.paper} />
          </Pressable>
        }
      />
      <ErrorBanner message={error} onRetry={refresh} />

      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.mist} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Name or shirt number"
          placeholderTextColor={colors.mist}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Find a player"
        />
      </View>

      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Everyone" },
          ...positions.map((p) => ({ value: p, label: positionGroupLabel[p] })),
          ...(outCount ? [{ value: "out" as const, label: `Out (${outCount})`, tone: colors.loss }] : []),
        ]}
      />

      {loading && players.length === 0 ? (
        <Loading label="Loading the squad…" />
      ) : visible.length === 0 ? (
        <Empty icon="search">{q ? `No one matches "${query}". Try a surname or a shirt number.` : "No players here yet."}</Empty>
      ) : layout === "cards" ? (
        <View style={styles.grid}>
          {visible.map((p, i) => (
            <Reveal key={p.id} index={i}>
              <GridCard player={p} width={cardWidth} out={currentAbsence(absences, p.id)} mine={p.id === myShirt} />
            </Reveal>
          ))}
        </View>
      ) : (
        positions.map((pos) => {
          const group = visible.filter((p) => p.position === pos);
          if (group.length === 0) return null;
          return (
            <Group key={pos} title={positionGroupLabel[pos]} aside={group.length}>
              {group.map((p) => {
                const c = cardCounts(cards, p.id);
                const out = currentAbsence(absences, p.id);
                const t = out ? absenceLabel(out.type) : null;
                return (
                  <Row key={p.id} onPress={() => router.push(`/player/${p.id}`)} accessibilityLabel={`${p.name}, number ${p.number}`}>
                    <Txt style={styles.rowNumber}>{p.number}</Txt>
                    <Avatar player={p} ring={p.id === myShirt ? colors.gold : undefined} />
                    <View style={styles.flex}>
                      <View style={styles.nameLine}>
                        <Txt style={[text.semi, styles.shrink]} numberOfLines={1}>
                          {p.name}
                        </Txt>
                        {p.membership === "guest" ? <MembershipBadge membership="guest" /> : null}
                      </View>
                      <View style={styles.metaLine}>
                        {t ? <Pill label={t.short} tone={t.tone} icon={t.icon} /> : <Txt style={text.small}>{plural(p.appearances, "game")}, {plural(p.goals, "goal")}</Txt>}
                        <CardPips yellow={c.unpaidYellow} red={c.unpaidRed} />
                      </View>
                    </View>
                    <Txt style={styles.rowRating}>{p.rating.toFixed(2)}</Txt>
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
  layoutToggle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: glass.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },

  search: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: glass.surface, borderRadius: radius.pill, paddingHorizontal: space.lg, marginBottom: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  searchInput: { flex: 1, minHeight: 46, color: colors.paper, fontFamily: fonts.body, fontSize: 16 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.xl },
  badges: { flexDirection: "row", gap: 4, marginBottom: 6 },

  rowNumber: { width: 30, textAlign: "right", fontFamily: fonts.displayHeavy, fontSize: 24, color: colors.paperDim, fontVariant: ["tabular-nums"] },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  rowRating: { fontFamily: fonts.display, fontSize: 22, color: colors.goldBright, fontVariant: ["tabular-nums"] },
});
