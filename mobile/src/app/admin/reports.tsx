import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Intro } from "../../components/form";
import { useClub } from "../../lib/club";
import { formatNaira, outstandingFines, positionGroupLabel, positions } from "../../lib/derive";
import type { Player, Position } from "../../lib/types";
import { Bar, Empty, Figures, Group, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

// The web Reports page (frontend/src/pages/admin/AdminReports.tsx) on a phone:
// the same figures and charts, stacked in one column.

const POSITION_COLORS: Record<Position, string> = { GK: "#3987e5", DEF: "#c98500", MID: "#199e70", FWD: "#d95926" };

function Leaderboard({
  title,
  players,
  value,
  display,
  tone,
}: {
  title: string;
  players: Player[];
  value: (p: Player) => number;
  display: (p: Player) => string;
  tone: string;
}) {
  const top = [...players].sort((a, b) => value(b) - value(a)).slice(0, 6).filter((p) => value(p) > 0);
  const max = top.length ? value(top[0]) : 0;
  return (
    <Group title={title}>
      {top.length === 0 ? (
        <Row>
          <Txt style={text.small}>Nothing recorded yet.</Txt>
        </Row>
      ) : (
        top.map((p, i) => (
          <Row key={p.id}>
            <Txt style={styles.rank}>{i + 1}</Txt>
            <View style={styles.flex}>
              <View style={styles.lineHead}>
                <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                  {p.name}
                </Txt>
                <Txt style={[text.small, text.tabular]}>{display(p)}</Txt>
              </View>
              <Bar value={value(p)} max={max} tone={tone} />
            </View>
          </Row>
        ))
      )}
    </Group>
  );
}

/** A ring split into coloured arcs, with the total in the middle and a legend. */
function Donut({ title, center, data }: { title: string; center: string; data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <Group title={title}>
      <View style={styles.donut}>
        <View style={styles.ring} accessibilityLabel={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
          <Svg width={size} height={size} style={styles.startAtTop}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.inkLine} strokeWidth={stroke} fill="none" />
            {total > 0
              ? data.map((d) => {
                  const length = (d.value / total) * circumference;
                  const arc = (
                    <Circle
                      key={d.label}
                      cx={size / 2}
                      cy={size / 2}
                      r={r}
                      stroke={d.color}
                      strokeWidth={stroke}
                      fill="none"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                    />
                  );
                  offset += length;
                  return arc;
                })
              : null}
          </Svg>
          <View style={styles.ringCenter}>
            <Txt style={styles.ringValue}>{total}</Txt>
            <Txt style={text.small}>{center}</Txt>
          </View>
        </View>
        <View style={styles.legend}>
          {data.map((d) => (
            <View key={d.label} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: d.color }]} />
              <Txt style={[text.dim, styles.flex]} numberOfLines={1}>
                {d.label}
              </Txt>
              <Txt style={[text.semi, text.tabular]}>{d.value}</Txt>
            </View>
          ))}
        </View>
      </View>
    </Group>
  );
}

export default function ReportsScreen() {
  const { players, cards, refresh } = useClub();

  const byPlayer = new Map<number, { yellow: number; red: number }>();
  for (const c of cards) {
    if (c.playerId == null) continue;
    const entry = byPlayer.get(c.playerId) ?? { yellow: 0, red: 0 };
    entry[c.type]++;
    byPlayer.set(c.playerId, entry);
  }
  const carded = [...byPlayer.entries()]
    .map(([id, counts]) => ({ id, name: players.find((p) => p.id === id)?.name ?? "Former player", ...counts }))
    .sort((a, b) => b.yellow + b.red - (a.yellow + a.red))
    .slice(0, 8);
  const mostCards = carded.length ? carded[0].yellow + carded[0].red : 0;

  return (
    <Screen onRefresh={refresh}>
      <Intro>Goals, assists, positional balance and discipline, at a glance.</Intro>

      <Figures
        items={[
          { label: "Goals", value: players.reduce((s, p) => s + p.goals, 0) },
          { label: "Assists", value: players.reduce((s, p) => s + p.assists, 0) },
          { label: "Cards", value: cards.length },
        ]}
      />
      <Figures items={[{ label: "Outstanding fines", value: formatNaira(outstandingFines(cards)), tone: colors.loss }]} />

      <Txt style={styles.heading}>Goals, assists & ratings</Txt>
      <Leaderboard title="Top scorers" players={players} value={(p) => p.goals} display={(p) => `${p.goals} goals`} tone={colors.win} />
      <Leaderboard title="Top assists" players={players} value={(p) => p.assists} display={(p) => `${p.assists} assists`} tone={colors.paper} />
      <Leaderboard title="Highest rated" players={players} value={(p) => p.rating} display={(p) => p.rating.toFixed(2)} tone={colors.draw} />

      <Txt style={styles.heading}>Squad composition</Txt>
      <Donut
        title="Players by position"
        center="Squad"
        data={positions.map((pos) => ({ label: positionGroupLabel[pos], value: players.filter((p) => p.position === pos).length, color: POSITION_COLORS[pos] }))}
      />

      <Txt style={styles.heading}>Discipline</Txt>
      <Donut
        title="Cards by type"
        center="Cards"
        data={[
          { label: "Yellow cards", value: cards.filter((c) => c.type === "yellow").length, color: colors.draw },
          { label: "Red cards", value: cards.filter((c) => c.type === "red").length, color: colors.loss },
        ]}
      />
      {carded.length === 0 ? (
        <Empty>No cards logged yet.</Empty>
      ) : (
        <Group title="Most carded players">
          {carded.map((p) => (
            <Row key={p.id}>
              <View style={styles.flex}>
                <View style={styles.lineHead}>
                  <Txt style={[text.semi, styles.flex]} numberOfLines={1}>
                    {p.name}
                  </Txt>
                  <Txt style={[text.small, text.tabular]}>
                    {p.yellow} Y · {p.red} R
                  </Txt>
                </View>
                <View style={styles.stack}>
                  <View style={{ flex: p.yellow, backgroundColor: colors.draw }} />
                  <View style={{ flex: p.red, backgroundColor: colors.loss }} />
                  <View style={{ flex: mostCards - p.yellow - p.red }} />
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
  heading: { fontFamily: fonts.display, fontSize: 24, color: colors.paper, marginBottom: space.md, marginTop: space.sm },
  rank: { width: 16, textAlign: "center", fontFamily: fonts.display, fontSize: 18, color: colors.mist },
  lineHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginBottom: 6 },
  stack: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: colors.inkLine },

  donut: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.lg },
  ring: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  startAtTop: { transform: [{ rotate: "-90deg" }] },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringValue: { fontFamily: fonts.display, fontSize: 30, color: colors.paper },
  legend: { flex: 1, gap: space.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  swatch: { width: 10, height: 10, borderRadius: radius.sm / 2 },
});
