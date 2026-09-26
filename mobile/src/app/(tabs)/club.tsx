import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth";
import { useClub } from "../../lib/club";
import { apiFetch } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { cardDate, formatNaira, outstandingFines, participantName, plural, scoreOf, sortEvents } from "../../lib/derive";
import { SignInForm } from "../../components/SignInForm";
import { confirm } from "../../components/form";
import { Avatar, Bar, Button, Group, PageTitle, RefCard, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

function SquadMember() {
  const { leave } = useAuth();
  return (
    <>
      <PageTitle title="Committee" sub="Sign in to run match days, manage the squad, fines and the club site." />
      <SignInForm />
      <View style={styles.spacer} />
      <Group>
        <Row
          onPress={() => confirm("Leave Noisers?", "You'll need the squad passcode to get back in.", "Leave", leave)}
          chevron={false}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.loss} />
          <Txt style={[text.body, styles.flex, { color: colors.loss }]}>Leave (forget the passcode)</Txt>
        </Row>
      </Group>
      <Txt style={[text.small, styles.server]}>Server: {API_URL}</Txt>
    </>
  );
}

/** The squad passcode, so staff can read it out to players. */
function useSquadPasscode() {
  const [passcode, setPasscode] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ passcode: string }>("/settings/passcode")
      .then((res) => setPasscode(res.passcode))
      .catch(() => setPasscode(null));
  }, []);
  return passcode;
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

type IconName = keyof typeof Ionicons.glyphMap;

/** The committee home — the phone version of the web admin dashboard. */
function Dashboard() {
  const { user, signOut } = useAuth();
  const { cards, players, events, refresh } = useClub();
  const passcode = useSquadPasscode();
  const [showPasscode, setShowPasscode] = useState(false);

  const unpaid = cards.filter((c) => !c.paid);
  const recent = cards.slice(0, 5);
  const liveEvent = events.find((e) => e.status === "live");
  const newest = sortEvents(events);
  const lastEvent = newest[0];
  const lastGame = newest.find((e) => e.games.length > 0)?.games.at(-1);
  const scorers = [...players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);
  const firstName = user?.name?.split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const sections: { label: string; href: Href; icon: IconName; meta: string }[] = [
    { label: "Match Day", href: "/admin/matchday", icon: "stopwatch-outline", meta: liveEvent ? "Live now" : "Start a session" },
    { label: "Squad", href: "/admin/squad", icon: "shirt-outline", meta: plural(players.length, "player") },
    { label: "Matches", href: "/admin/matches", icon: "calendar-outline", meta: plural(events.length, "match day") },
    { label: "Cards & fines", href: "/admin/cards", icon: "albums-outline", meta: `${unpaid.length} unpaid` },
    { label: "Reports", href: "/admin/reports", icon: "stats-chart-outline", meta: "Season stats" },
    { label: "Home page", href: "/admin/home-content", icon: "home-outline", meta: "Public site copy & images" },
    { label: "The Vale", href: "/admin/vale", icon: "trophy-outline", meta: "Weekly awards" },
    { label: "Highlights", href: "/admin/highlights", icon: "images-outline", meta: "Photo & video gallery" },
    { label: "Settings", href: "/admin/settings", icon: "settings-outline", meta: "Fines, match rules, ratings" },
  ];

  return (
    <>
      <View style={styles.hero}>
        <Image source={require("../../../assets/brand/logo-white.png")} style={styles.heroCrest} contentFit="contain" />
        <Txt style={styles.heroDate}>{today}</Txt>
        <Txt style={styles.heroTitle} accessibilityRole="header">
          {greeting()}
          {firstName ? `, ${firstName}` : ""}
        </Txt>
        <Txt style={[text.dim, styles.heroSub]}>
          {liveEvent
            ? `${liveEvent.title} is live${liveEvent.venue ? ` at ${liveEvent.venue}` : ""}.`
            : `${plural(players.length, "player")} · ${plural(events.length, "match day")} · ${plural(unpaid.length, "unpaid card")}`}
        </Txt>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              label={liveEvent ? "Resume" : "Match day"}
              icon={liveEvent ? "radio-button-on" : "play"}
              onPress={() => router.push("/admin/matchday")}
            />
          </View>
          <View style={styles.flex}>
            <Button label="Log a card" variant="secondary" icon="add" onPress={() => router.push("/admin/new-card")} />
          </View>
        </View>
      </View>

      <View style={styles.tiles}>
        <Tile label="Match days" value={String(events.length)} hint={lastEvent ? `Last: ${lastEvent.title}` : "None recorded yet"} />
        <Tile
          label="Last result"
          value={lastGame ? `${scoreOf(lastGame, 0)}–${scoreOf(lastGame, 1)}` : "–"}
          hint={lastGame ? `${lastGame.teams[0].name} vs ${lastGame.teams[1].name}` : "No games yet"}
        />
        <Tile
          label="Top scorer"
          value={scorers[0]?.name ?? "–"}
          hint={scorers[0] ? `${plural(scorers[0].goals, "goal")} · #${scorers[0].number}` : undefined}
        />
        <Tile
          label="Unpaid fines"
          value={formatNaira(outstandingFines(cards))}
          hint={plural(unpaid.length, "unpaid card")}
          tone={unpaid.length ? colors.loss : colors.win}
        />
      </View>

      <Group title="Committee tools">
        {sections.map((s) => (
          <Row key={s.label} onPress={() => router.push(s.href)} accessibilityLabel={`${s.label}, ${s.meta}`}>
            <View style={styles.icon}>
              <Ionicons name={s.icon} size={18} color={colors.paper} />
            </View>
            <View style={styles.flex}>
              <Txt style={text.semi}>{s.label}</Txt>
              <Txt style={[text.small, s.label === "Match Day" && liveEvent ? { color: colors.loss } : null]} numberOfLines={1}>
                {s.meta}
              </Txt>
            </View>
          </Row>
        ))}
      </Group>

      <Group title="Recent cards" aside={recent.length ? undefined : "None yet"}>
        {recent.length === 0 ? (
          <Row>
            <Txt style={text.small}>No cards have been logged.</Txt>
          </Row>
        ) : (
          recent.map((c) => (
            <Row key={c.id} onPress={() => router.push("/admin/cards")}>
              <RefCard type={c.type} size="md" />
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {c.playerId != null ? participantName(players, [], c.playerId) : "Unknown player"}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  {[c.reason, cardDate(c)].filter(Boolean).join(", ")}
                </Txt>
              </View>
              <Txt style={[text.small, { color: c.paid ? colors.win : colors.loss }]}>{c.paid ? "Paid" : formatNaira(c.fineAmount)}</Txt>
            </Row>
          ))
        )}
      </Group>

      <Group title="Top scorers" aside={scorers.length ? undefined : "No goals yet"}>
        {scorers.length === 0 ? (
          <Row>
            <Txt style={text.small}>Goals show up here once a match day game finishes.</Txt>
          </Row>
        ) : (
          scorers.map((p, i) => (
            <Row key={p.id} onPress={() => router.push(`/player/${p.id}`)}>
              <Txt style={styles.rank}>{i + 1}</Txt>
              <Avatar player={p} size={36} />
              <View style={styles.flex}>
                <Txt style={text.semi} numberOfLines={1}>
                  {p.name}
                </Txt>
                <View style={styles.bar}>
                  <Bar value={p.goals} max={scorers[0].goals} />
                </View>
              </View>
              <Txt style={styles.goals}>{p.goals}</Txt>
            </Row>
          ))
        )}
      </Group>

      <Group title="Squad passcode" aside={user?.role === "admin" ? "Change it in Settings" : undefined}>
        <Row
          onPress={passcode ? () => setShowPasscode((s) => !s) : undefined}
          chevron={false}
          accessibilityLabel={showPasscode ? `Passcode ${passcode}` : "Show squad passcode"}
        >
          <Ionicons name="key-outline" size={18} color={colors.paperDim} />
          <Txt style={[text.semi, styles.flex]} selectable={showPasscode}>
            {passcode === null ? "Unavailable" : showPasscode ? passcode : "••••••••"}
          </Txt>
          {passcode ? <Txt style={text.small}>{showPasscode ? "Hide" : "Show"}</Txt> : null}
        </Row>
      </Group>

      <Group title="Account">
        <Row onPress={refresh} chevron={false}>
          <Ionicons name="refresh" size={18} color={colors.paperDim} />
          <Txt style={[text.body, styles.flex]}>Reload club data</Txt>
        </Row>
        <Row
          onPress={() => confirm("Sign out?", "You'll stay in the app if this phone has the squad passcode.", "Sign out", signOut)}
          chevron={false}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.loss} />
          <Txt style={[text.body, styles.flex, { color: colors.loss }]}>Sign out</Txt>
        </Row>
      </Group>
      <Txt style={[text.small, styles.server]}>
        {user ? `${user.name} · ${user.role === "admin" ? "Admin" : "Committee"} · ` : ""}Server: {API_URL}
      </Txt>
    </>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <View style={styles.tile}>
      <Txt style={styles.tileLabel}>{label}</Txt>
      <Txt style={[styles.tileValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      {hint ? (
        <Txt style={text.small} numberOfLines={2}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export default function ClubScreen() {
  const { status } = useAuth();
  const { refresh } = useClub();
  const signedIn = status === "signedIn";

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen onRefresh={signedIn ? refresh : undefined} topInset>
        {signedIn ? <Dashboard /> : <SquadMember />}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  spacer: { height: space.xl },
  server: { marginTop: space.lg, textAlign: "center" },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.lg },

  hero: {
    backgroundColor: colors.inkRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.inkLine,
    padding: space.lg,
    paddingTop: space.xl,
    marginBottom: space.lg,
    overflow: "hidden",
  },
  heroCrest: { position: "absolute", right: -30, top: -30, width: 150, height: 150, opacity: 0.08 },
  heroDate: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: colors.paperDim },
  heroTitle: { marginTop: 6, fontFamily: fonts.displayHeavy, fontSize: 38, lineHeight: 40, color: colors.paper },
  heroSub: { marginTop: 6, lineHeight: 20 },

  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.xl },
  tile: { flexBasis: "46%", flexGrow: 1, backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.lg, gap: 4 },
  tileLabel: { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.mist },
  tileValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.paper, marginTop: 4 },

  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.inkLine, alignItems: "center", justifyContent: "center" },
  rank: { width: 16, textAlign: "center", fontFamily: fonts.display, fontSize: 18, color: colors.mist },
  bar: { marginTop: 6 },
  goals: { fontFamily: fonts.display, fontSize: 24, color: colors.paper, fontVariant: ["tabular-nums"] },
});
