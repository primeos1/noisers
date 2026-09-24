import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useClub } from "../../lib/club";
import { cardCounts, cardDate, formatNaira, playerGameLog, plural, positionLabel } from "../../lib/derive";
import {
  Avatar,
  CardPips,
  Empty,
  Figures,
  Group,
  Loading,
  PageTitle,
  RatingMeter,
  RefCard,
  ResultChip,
  Row,
  Screen,
  Segmented,
  Txt,
  text,
} from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

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
  const { number } = useLocalSearchParams<{ number: string }>();
  const { players, cards, events, loading, refresh, myShirt, setMyShirt } = useClub();
  const [tab, setTab] = useState<Tab>("overview");

  const playerNumber = Number(number);
  const player = players.find((p) => p.number === playerNumber);

  if (!player) {
    return (
      <Screen onRefresh={refresh}>
        {loading ? <Loading label="Loading player…" /> : <Empty>{`Nobody wears number ${number} for Noisers. Pick someone from the Squad tab.`}</Empty>}
      </Screen>
    );
  }

  const log = playerGameLog(events, playerNumber);
  const finished = log.filter((g) => g.result !== null);
  const record = {
    W: finished.filter((g) => g.result === "W").length,
    D: finished.filter((g) => g.result === "D").length,
    L: finished.filter((g) => g.result === "L").length,
  };
  const fines = cardCounts(cards, playerNumber);
  const contributions = player.goals + player.assists;
  const isMe = myShirt === playerNumber;
  const form = finished.slice(0, 10);
  const firstName = player.name.split(" ")[0];

  const matchDays = [...new Map(log.map((g) => [g.event.id, g.event])).values()].map((event) => {
    const games = log.filter((g) => g.event.id === event.id);
    return {
      event,
      games,
      goals: games.reduce((s, g) => s + g.goals, 0),
      assists: games.reduce((s, g) => s + g.assists, 0),
    };
  });

  return (
    <Screen onRefresh={refresh}>
      <PageTitle title={player.name} sub={`${positionLabel[player.position]}, number ${player.number}`} />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Avatar player={player} size={120} rounded={radius.md} />
          <View style={styles.flex}>
            <Txt style={text.small}>Rating</Txt>
            <Txt style={styles.rating}>{player.rating.toFixed(2)}</Txt>
            <RatingMeter rating={player.rating} />
          </View>
        </View>
        <View style={styles.heroBottom}>
          <View style={styles.formRow}>
            {form.length ? (
              form.slice(0, 5).map((g) => <ResultChip key={`${g.event.id}-${g.game.id}`} result={g.result} />)
            ) : (
              <Txt style={text.small}>No results yet</Txt>
            )}
          </View>
          <Pressable
            onPress={() => setMyShirt(isMe ? null : playerNumber)}
            accessibilityRole="button"
            accessibilityState={{ selected: isMe }}
            style={[styles.meButton, isMe ? styles.meButtonActive : null]}
          >
            <Txt style={[text.semi, styles.meText, isMe ? styles.meTextActive : null]}>{isMe ? "This is you" : "This is me"}</Txt>
          </Pressable>
        </View>
      </View>

      <Figures
        items={[
          { label: "Games", value: player.appearances },
          { label: "Goals", value: player.goals, tone: colors.win },
          { label: "Assists", value: player.assists },
          { label: "Clean sheets", value: player.cleanSheets },
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
              {fines.cards.length ? <CardPips yellow={fines.yellow} red={fines.red} /> : <Txt style={text.semi}>None</Txt>}
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
          {fines.cards.length === 0 ? (
            <Empty>No cards, no fines. Keep it that way.</Empty>
          ) : (
            <Group title="Cards">
              {fines.cards.map((c) => (
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  alignRight: { alignItems: "flex-end" },
  hero: { backgroundColor: colors.inkRaised, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl, borderWidth: 1, borderColor: "rgba(168,132,31,0.25)" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: space.lg },
  rating: { fontFamily: fonts.displayHeavy, fontSize: 56, lineHeight: 58, color: colors.draw, fontVariant: ["tabular-nums"], marginBottom: 8 },
  heroBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, marginTop: space.lg },
  formRow: { flexDirection: "row", gap: 6 },
  meButton: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.inkLine },
  meButtonActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  meText: { fontSize: 13, color: colors.paperDim },
  meTextActive: { color: colors.ink },
  gameScore: { fontFamily: fonts.display, fontSize: 18, color: colors.paper },
  formCard: { backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.lg, marginBottom: space.xl },
  formGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
});
