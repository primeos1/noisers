import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import {
  eventContributions,
  eventGoals,
  eventParticipants,
  formatNaira,
  participantName,
  scoreOf,
} from "../../lib/derive";
import type { MatchDayGame, MatchDayTeam, ParticipantId } from "../../lib/types";
import { CardPips, Empty, Figures, Group, LiveTag, Loading, PageTitle, RefCard, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

function GameCard({ game, number, name }: { game: MatchDayGame; number: number; name: (id: ParticipantId) => string }) {
  const [open, setOpen] = useState(false);
  const [a, b] = [scoreOf(game, 0), scoreOf(game, 1)];
  const timeline = [
    ...game.goals.map((g) => ({
      key: g.id,
      minute: g.minute,
      team: g.teamIndex,
      kind: g.ownGoal ? ("og" as const) : ("goal" as const),
      text: name(g.playerId),
      sub: g.ownGoal ? "Own goal" : g.assistPlayerId != null ? `Assist from ${name(g.assistPlayerId)}` : "",
    })),
    ...game.cards.map((c) => ({
      key: c.id,
      minute: c.minute,
      team: c.teamIndex,
      kind: c.type,
      text: name(c.playerId),
      sub: c.reason,
    })),
  ].sort((x, y) => x.minute - y.minute);

  return (
    <View style={styles.game}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={timeline.length === 0}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Game ${number}: ${game.teams[0].name} ${a}, ${game.teams[1].name} ${b}`}
        style={({ pressed }) => [styles.gameHead, pressed ? styles.pressed : null]}
      >
        <View style={styles.gameMeta}>
          <Txt style={text.small}>Game {number}</Txt>
          {game.status === "live" ? <LiveTag /> : <Txt style={text.small}>Full time</Txt>}
        </View>
        <View style={styles.scoreLine}>
          <Txt style={[text.semi, styles.team, a > b ? null : styles.teamDim]} numberOfLines={1}>
            {game.teams[0].name}
          </Txt>
          <Txt style={styles.score}>
            {a}
            <Txt style={styles.scoreColon}> : </Txt>
            {b}
          </Txt>
          <Txt style={[text.semi, styles.team, styles.teamRight, b > a ? null : styles.teamDim]} numberOfLines={1}>
            {game.teams[1].name}
          </Txt>
        </View>
        <View style={styles.toggle}>
          <Txt style={text.small}>
            {timeline.length ? `${open ? "Hide" : "Show"} ${timeline.length} event${timeline.length === 1 ? "" : "s"}` : "No goals or cards"}
          </Txt>
          {timeline.length > 0 ? <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.mist} /> : null}
        </View>
      </Pressable>
      {open && timeline.length > 0 ? (
        <View style={styles.timeline}>
          {timeline.map((t) => (
            <View key={t.key} style={[styles.event, t.team === 1 ? styles.eventRight : null]}>
              <Txt style={styles.minute}>{t.minute}'</Txt>
              {t.kind === "goal" || t.kind === "og" ? (
                <Ionicons name="football" size={16} color={t.kind === "og" ? colors.loss : colors.win} accessibilityLabel={t.kind === "og" ? "Own goal" : "Goal"} />
              ) : (
                <RefCard type={t.kind} size="md" />
              )}
              <View style={[styles.flex, t.team === 1 ? styles.alignRight : null]}>
                <Txt style={text.body} numberOfLines={1}>
                  {t.text}
                </Txt>
                {t.sub ? (
                  <Txt style={text.small} numberOfLines={1}>
                    {t.sub}
                  </Txt>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TeamRoster({ team, name }: { team: MatchDayTeam; name: (id: ParticipantId) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.roster}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.rosterHead, pressed ? styles.pressed : null]}
      >
        <Txt style={[text.display, styles.rosterName]}>{team.name}</Txt>
        <View style={styles.rosterCount}>
          <Txt style={text.small}>{team.players.length} players</Txt>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.mist} />
        </View>
      </Pressable>
      {open
        ? team.players.map((pid) => (
            <View key={String(pid)} style={styles.rosterRow}>
              <Txt style={styles.rosterNumber}>{typeof pid === "number" ? pid : ""}</Txt>
              <Txt style={[text.body, styles.flex]}>{name(pid)}</Txt>
              {typeof pid !== "number" ? <Txt style={text.small}>Guest</Txt> : null}
            </View>
          ))
        : null}
    </View>
  );
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, players, settings, loading, refresh } = useClub();
  const event = events.find((e) => e.id === id);

  if (!event) {
    return (
      <Screen onRefresh={refresh}>
        {loading ? <Loading label="Loading match day…" /> : <Empty>This match day doesn't exist any more. Pick another one from Matches.</Empty>}
      </Screen>
    );
  }

  const name = (pid: ParticipantId) => participantName(players, event.guests, pid);
  const allCards = event.games.flatMap((g) => g.cards);
  const yellows = allCards.filter((c) => c.type === "yellow").length;
  const reds = allCards.filter((c) => c.type === "red").length;
  const fines = yellows * settings.yellowCardFine + reds * settings.redCardFine;
  const contributions = eventContributions(event, players);
  const involved = contributions.filter((c) => c.goals || c.assists || c.yellows || c.reds);
  const alsoPlayed = contributions.filter((c) => !involved.includes(c));

  const rosters: MatchDayTeam[] = event.groups.length
    ? event.groups
    : [...new Map(event.games.flatMap((g) => g.teams).map((t) => [t.name, t])).values()];

  return (
    <Screen onRefresh={refresh}>
      <PageTitle
        title={event.title}
        sub={
          <View style={styles.subLine}>
            <Txt style={text.small}>{[event.date, event.venue].filter(Boolean).join(", ")}</Txt>
            {event.status === "live" ? <LiveTag /> : null}
          </View>
        }
      />

      <Figures
        items={[
          { label: "Games", value: event.games.length },
          { label: "Goals", value: eventGoals(event), tone: colors.win },
          { label: "Players", value: eventParticipants(event) },
        ]}
      />

      <Txt style={styles.sectionTitle} accessibilityRole="header">
        Games
      </Txt>
      {event.games.length === 0 ? (
        <Empty>No games have kicked off yet.</Empty>
      ) : (
        <View style={styles.games}>
          {event.games.map((game, i) => (
            <GameCard key={game.id} game={game} number={i + 1} name={name} />
          ))}
        </View>
      )}

      <Group title="Goals, assists and cards" aside={involved.length ? undefined : "None yet"}>
        {involved.length === 0 ? (
          <Row>
            <Txt style={text.small}>Nobody has scored, assisted or been booked yet.</Txt>
          </Row>
        ) : (
          involved.map((c) => {
            const fine = c.yellows * settings.yellowCardFine + c.reds * settings.redCardFine;
            const pid = c.id;
            return (
              <Row key={String(pid)} onPress={typeof pid === "number" ? () => router.push(`/player/${pid}`) : undefined}>
                <View style={styles.flex}>
                  <Txt style={text.semi} numberOfLines={1}>
                    {c.name}
                  </Txt>
                  <View style={styles.subLine}>
                    <Txt style={text.small}>{c.position ?? "Guest"}</Txt>
                    {fine > 0 ? <Txt style={[text.small, { color: colors.loss }]}>{formatNaira(fine)} fine</Txt> : null}
                  </View>
                </View>
                <CardPips yellow={c.yellows} red={c.reds} />
                <View style={styles.ga}>
                  {c.goals > 0 ? (
                    <Txt style={[styles.gaValue, { color: colors.win }]}>
                      {c.goals}
                      <Txt style={styles.gaUnit}>G</Txt>
                    </Txt>
                  ) : null}
                  {c.assists > 0 ? (
                    <Txt style={styles.gaValue}>
                      {c.assists}
                      <Txt style={styles.gaUnit}>A</Txt>
                    </Txt>
                  ) : null}
                </View>
              </Row>
            );
          })
        )}
      </Group>
      {alsoPlayed.length > 0 ? (
        <Txt style={[text.small, styles.alsoPlayed]}>Also played: {alsoPlayed.map((c) => c.name).join(", ")}</Txt>
      ) : null}

      {fines > 0 ? (
        <Group title="Card fines" aside={formatNaira(fines)}>
          <Row>
            <RefCard type="yellow" size="md" />
            <Txt style={[text.dim, styles.flex]}>
              {yellows} yellow at {formatNaira(settings.yellowCardFine)}
            </Txt>
            <Txt style={text.semi}>{formatNaira(yellows * settings.yellowCardFine)}</Txt>
          </Row>
          <Row>
            <RefCard type="red" size="md" />
            <Txt style={[text.dim, styles.flex]}>
              {reds} red at {formatNaira(settings.redCardFine)}
            </Txt>
            <Txt style={text.semi}>{formatNaira(reds * settings.redCardFine)}</Txt>
          </Row>
        </Group>
      ) : null}

      <Txt style={styles.sectionTitle} accessibilityRole="header">
        Teams
      </Txt>
      {rosters.length === 0 ? (
        <Empty>Teams haven't been picked yet.</Empty>
      ) : (
        <View style={styles.games}>
          {rosters.map((team) => (
            <TeamRoster key={team.name} team={team} name={name} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: "rgba(38,47,69,0.4)" },
  subLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim, marginBottom: space.sm, paddingHorizontal: 4 },
  games: { gap: space.md, marginBottom: space.xl },

  game: { backgroundColor: colors.inkRaised, borderRadius: radius.md, overflow: "hidden" },
  gameHead: { paddingHorizontal: space.lg, paddingVertical: space.md },
  gameMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLine: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: 4 },
  team: { flex: 1, fontSize: 15 },
  teamRight: { textAlign: "right" },
  teamDim: { color: colors.paperDim },
  score: { fontFamily: fonts.displayHeavy, fontSize: 48, lineHeight: 52, color: colors.paper, fontVariant: ["tabular-nums"] },
  scoreColon: { color: colors.inkLine },
  toggle: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 6 },
  timeline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine, paddingHorizontal: space.lg, paddingVertical: space.sm },
  event: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  eventRight: { flexDirection: "row-reverse" },
  alignRight: { alignItems: "flex-end" },
  minute: { width: 34, textAlign: "center", fontFamily: fonts.display, fontSize: 18, color: colors.mist, fontVariant: ["tabular-nums"] },

  ga: { flexDirection: "row", gap: space.md },
  gaValue: { fontFamily: fonts.display, fontSize: 20, color: colors.paper, fontVariant: ["tabular-nums"] },
  gaUnit: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.mist },
  alsoPlayed: { marginTop: -12, marginBottom: space.xl, paddingHorizontal: 4, lineHeight: 18 },

  roster: { backgroundColor: colors.inkRaised, borderRadius: radius.md, overflow: "hidden" },
  rosterHead: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg },
  rosterName: { fontSize: 20 },
  rosterCount: { flexDirection: "row", alignItems: "center", gap: 6 },
  rosterRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },
  rosterNumber: { width: 28, textAlign: "right", fontFamily: fonts.display, fontSize: 18, color: colors.mist },
});
