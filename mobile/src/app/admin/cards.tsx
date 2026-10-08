import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { cardDate, formatNaira, outstandingFines, participantName } from "../../lib/derive";
import type { Card } from "../../lib/types";
import { CardPips, Empty, ErrorBanner, Figures, Group, Row, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors, radius, space } from "../../theme";

type Filter = "unpaid" | "paid" | "all" | "yellow" | "red";

/** All of one player's cards, added up into a single row. */
interface CardGroup {
  playerId: number;
  /** Newest first. */
  cards: Card[];
  yellows: number;
  reds: number;
  fine: number;
  paid: boolean;
}

function groupCards(cards: Card[]): CardGroup[] {
  const groups = new Map<number, CardGroup>();
  for (const card of cards) {
    const group = groups.get(card.playerId) ?? { playerId: card.playerId, cards: [], yellows: 0, reds: 0, fine: 0, paid: true };
    group.cards.push(card);
    if (card.type === "red") group.reds += 1;
    else group.yellows += 1;
    group.fine += card.fineAmount;
    group.paid &&= card.paid;
    groups.set(card.playerId, group);
  }
  // Card ids go up as they're logged, so the highest is the latest.
  for (const group of groups.values()) group.cards.sort((a, b) => b.id - a.id);
  return [...groups.values()];
}

/** Distinct reasons, and the first and latest dates when they differ. */
function groupDetail(group: CardGroup) {
  const reasons = [...new Set(group.cards.map((c) => c.reason).filter(Boolean))].join(", ");
  const newest = cardDate(group.cards[0]);
  const oldest = cardDate(group.cards[group.cards.length - 1]);
  return [reasons, newest === oldest ? newest : `${oldest} – ${newest}`].filter(Boolean).join(", ");
}

export default function CardsScreen() {
  const { cards, players, settings, refresh, setCardPaid, removeCard } = useClub();
  const [filter, setFilter] = useState<Filter>("unpaid");
  const [error, setError] = useState("");

  const visible = cards.filter((c) =>
    filter === "all" ? true : filter === "paid" ? c.paid : filter === "unpaid" ? !c.paid : c.type === filter,
  );
  const groups = groupCards(visible);
  const collected = cards.filter((c) => c.paid).reduce((s, c) => s + c.fineAmount, 0);
  const nameOf = (c: Card) => (c.playerId != null ? participantName(players, [], c.playerId) : "Unknown player");

  // A partly paid group gets marked fully paid; a fully paid one goes back to owing.
  async function togglePaid(group: CardGroup) {
    setError("");
    const paid = !group.paid;
    try {
      await Promise.all(group.cards.filter((c) => c.paid !== paid).map((c) => setCardPaid(c.id, paid)));
    } catch (err) {
      setError(errorMessage(err, "Couldn't update that card."));
    }
  }

  // Deletes one card at a time — the latest in the group.
  function confirmRemove(group: CardGroup) {
    const card = group.cards[0];
    const which = group.cards.length > 1 ? `latest card (a ${card.type}, of ${group.cards.length})` : `${card.type} card`;
    Alert.alert("Delete this card?", `${nameOf(card)}'s ${which} and its ${formatNaira(card.fineAmount)} fine will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setError("");
          try {
            await removeCard(card.id);
          } catch (err) {
            setError(errorMessage(err, "Couldn't delete that card."));
          }
        },
      },
    ]);
  }

  return (
    <Screen onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/admin/new-card")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Log a card">
              <Ionicons name="add" size={26} color={colors.paper} />
            </Pressable>
          ),
        }}
      />

      <Figures
        items={[
          { label: "Owed", value: formatNaira(outstandingFines(cards)), tone: colors.loss },
          { label: "Collected", value: formatNaira(collected), tone: colors.win },
          { label: "Yellow", value: cards.filter((c) => c.type === "yellow").length, tone: colors.draw },
          { label: "Red", value: cards.filter((c) => c.type === "red").length, tone: colors.loss },
        ]}
      />
      <Txt style={[text.small, styles.rates]}>
        Yellow cards are {formatNaira(settings.yellowCardFine)}, red cards {formatNaira(settings.redCardFine)}.
      </Txt>

      <ErrorBanner message={error} />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "unpaid", label: "Unpaid" },
          { value: "paid", label: "Paid" },
          { value: "all", label: "All" },
          { value: "yellow", label: "Yellow" },
          { value: "red", label: "Red" },
        ]}
      />

      {visible.length === 0 ? (
        <Empty>{filter === "unpaid" ? "Everyone's paid up." : "No cards match this filter."}</Empty>
      ) : (
        <Group aside="Tap to mark paid, long-press to delete">
          {groups.map((g) => (
            <Row
              key={g.playerId}
              onPress={() => togglePaid(g)}
              onLongPress={() => confirmRemove(g)}
              chevron={false}
              accessibilityLabel={`${nameOf(g.cards[0])}, ${g.yellows} yellow, ${g.reds} red, ${g.paid ? "paid" : "not paid"}`}
            >
              <CardPips yellow={g.yellows} red={g.reds} />
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {nameOf(g.cards[0])}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  {groupDetail(g)}
                </Txt>
              </View>
              <View style={styles.amount}>
                <Txt style={[text.semi, text.tabular]}>{formatNaira(g.fine)}</Txt>
                <View style={[styles.status, g.paid ? styles.statusPaid : styles.statusUnpaid]}>
                  <Ionicons name={g.paid ? "checkmark" : "time-outline"} size={12} color={g.paid ? colors.win : colors.loss} />
                  <Txt style={[text.small, { color: g.paid ? colors.win : colors.loss }]}>{g.paid ? "Paid" : "Unpaid"}</Txt>
                </View>
              </View>
            </Row>
          ))}
        </Group>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  rates: { marginTop: -space.md, marginBottom: space.lg, paddingHorizontal: 4 },
  amount: { alignItems: "flex-end", gap: 4 },
  status: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  statusPaid: { backgroundColor: "rgba(47,158,138,0.15)" },
  statusUnpaid: { backgroundColor: "rgba(194,59,107,0.15)" },
});
