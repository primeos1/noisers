import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { cardDate, formatNaira, outstandingFines, participantName } from "../../lib/derive";
import type { Card } from "../../lib/types";
import { Empty, ErrorBanner, Figures, Group, RefCard, Row, Screen, Segmented, Txt, text } from "../../components/ui";
import { colors, radius, space } from "../../theme";

type Filter = "unpaid" | "paid" | "all" | "yellow" | "red";

export default function CardsScreen() {
  const { cards, players, settings, refresh, setCardPaid, removeCard } = useClub();
  const [filter, setFilter] = useState<Filter>("unpaid");
  const [error, setError] = useState("");

  const visible = cards.filter((c) =>
    filter === "all" ? true : filter === "paid" ? c.paid : filter === "unpaid" ? !c.paid : c.type === filter,
  );
  const collected = cards.filter((c) => c.paid).reduce((s, c) => s + c.fineAmount, 0);
  const nameOf = (c: Card) => (c.playerId != null ? participantName(players, [], c.playerId) : "Unknown player");

  async function togglePaid(card: Card) {
    setError("");
    try {
      await setCardPaid(card.id, !card.paid);
    } catch (err) {
      setError(errorMessage(err, "Couldn't update that card."));
    }
  }

  function confirmRemove(card: Card) {
    Alert.alert("Delete this card?", `${nameOf(card)}'s ${card.type} card and its ${formatNaira(card.fineAmount)} fine will be removed.`, [
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
          {visible.map((c) => (
            <Row
              key={c.id}
              onPress={() => togglePaid(c)}
              onLongPress={() => confirmRemove(c)}
              chevron={false}
              accessibilityLabel={`${nameOf(c)}, ${c.type} card, ${c.paid ? "paid" : "not paid"}`}
            >
              <RefCard type={c.type} size="md" />
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {nameOf(c)}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  {[c.reason, cardDate(c)].filter(Boolean).join(", ")}
                </Txt>
              </View>
              <View style={styles.amount}>
                <Txt style={[text.semi, text.tabular]}>{formatNaira(c.fineAmount)}</Txt>
                <View style={[styles.status, c.paid ? styles.statusPaid : styles.statusUnpaid]}>
                  <Ionicons name={c.paid ? "checkmark" : "time-outline"} size={12} color={c.paid ? colors.win : colors.loss} />
                  <Txt style={[text.small, { color: c.paid ? colors.win : colors.loss }]}>{c.paid ? "Paid" : "Unpaid"}</Txt>
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
