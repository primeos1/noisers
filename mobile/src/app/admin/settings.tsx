import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import { DEFAULT_RATING_WEIGHTS, useClub } from "../../lib/club";
import { apiFetch, errorMessage } from "../../lib/api";
import { SITE_URL } from "../../lib/config";
import { formatNaira, plural, sortEvents } from "../../lib/derive";
import type { ClubSettings, Position, RatingWeightKey, TeamMode } from "../../lib/types";
import {
  Choice,
  Col,
  FieldRow,
  FormError,
  Hint,
  Label,
  NumberField,
  SaveBar,
  Section,
  SwitchRow,
  TextField,
  confirmRemoveEvent,
  matchDaySummary,
  Intro,
} from "../../components/form";
import { Button, ErrorBanner, Group, LiveTag, Loading, Row, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

const teamModes: { value: TeamMode; label: string; hint: string }[] = [
  { value: "random", label: "Random", hint: "Just a shuffle" },
  { value: "rating", label: "By rating", hint: "Even out strength" },
  { value: "position", label: "By position", hint: "Even out positions" },
];

const ratingPositions: { value: Position; label: string }[] = [
  { value: "GK", label: "GK" },
  { value: "DEF", label: "DEF" },
  { value: "MID", label: "MID" },
  { value: "FWD", label: "FWD" },
];

const positionNames: Record<Position, string> = { GK: "goalkeepers", DEF: "defenders", MID: "midfielders", FWD: "forwards" };

// Each weight in rows of up to three; the − ones are taken away.
const ratingWeightRows: { key: RatingWeightKey; label: string; suffix: "+" | "−" }[][] = [
  [
    { key: "win", label: "Win", suffix: "+" },
    { key: "loss", label: "Loss", suffix: "−" },
    { key: "goal", label: "Goal", suffix: "+" },
  ],
  [
    { key: "assist", label: "Assist", suffix: "+" },
    { key: "cleanSheet", label: "Clean sheet", suffix: "+" },
    { key: "save", label: "Save", suffix: "+" },
  ],
  [
    { key: "goalConceded", label: "Conceded", suffix: "−" },
    { key: "ownGoal", label: "Own goal", suffix: "−" },
  ],
  [
    { key: "yellowCard", label: "Yellow", suffix: "−" },
    { key: "redCard", label: "Red card", suffix: "−" },
  ],
];

// Compared by content, so an edited-then-reverted weight doesn't count as a change.
function same(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function hasBlank(value: unknown): boolean {
  if (typeof value === "number") return Number.isNaN(value);
  if (value && typeof value === "object") return Object.values(value).some(hasBlank);
  return false;
}

function signed(n: number) {
  const v = Number.isNaN(n) ? 0 : n;
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
}

function SettingsForm({ canEdit, passcode: initialPasscode }: { canEdit: boolean; passcode: string }) {
  const { settings, updateSettings } = useClub();
  const [draft, setDraft] = useState<ClubSettings>(settings);
  const [passcode, setPasscode] = useState(initialPasscode);
  const [passcodeDraft, setPasscodeDraft] = useState(initialPasscode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [ratingPosition, setRatingPosition] = useState<Position>("GK");

  const changed = (Object.keys(draft) as (keyof ClubSettings)[]).filter((k) => !same(draft[k], settings[k]));
  const passcodeChanged = passcodeDraft.trim() !== "" && passcodeDraft.trim() !== passcode;
  const count = changed.length + (passcodeChanged ? 1 : 0);
  const off = !canEdit;

  function set<K extends keyof ClubSettings>(key: K, value: ClubSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function setWeight(key: RatingWeightKey, value: number) {
    set("ratingPositions", { ...draft.ratingPositions, [ratingPosition]: { ...draft.ratingPositions[ratingPosition], [key]: value } });
  }

  async function save() {
    if (changed.some((k) => hasBlank(draft[k]))) {
      setError("Fill in every number before saving.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (changed.length) await updateSettings(Object.fromEntries(changed.map((k) => [k, draft[k]])));
      if (passcodeChanged) {
        const res = await apiFetch<{ passcode: string }>("/settings/passcode", { method: "PUT", body: { passcode: passcodeDraft.trim() } });
        setPasscode(res.passcode);
        setPasscodeDraft(res.passcode);
      }
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save settings."));
    } finally {
      setSaving(false);
    }
  }

  const n = (key: keyof ClubSettings, label: string, suffix: string) => (
    <NumberField label={label} value={draft[key] as number} onChange={(v) => set(key, v)} decimal suffix={suffix} disabled={off || !draft.ratingsEnabled} />
  );

  return (
    <View style={styles.flex}>
      <Screen>
        <Intro>How the club runs: fines, match day rules, how ratings move and what updates automatically. Shared across every device.</Intro>

        {off ? (
          <View style={styles.notice}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.paperDim} />
            <Txt style={[text.small, styles.flex]}>Committee accounts can view settings but not change them. Ask an admin to update these.</Txt>
          </View>
        ) : null}

        <Section title="Discipline" description="Fines for cards. Changing an amount only affects cards logged from now on.">
          <FieldRow>
            <Col>
              <NumberField label="Yellow card fine" value={draft.yellowCardFine} onChange={(v) => set("yellowCardFine", v)} suffix="₦" hint={formatNaira(draft.yellowCardFine || 0)} disabled={off} />
            </Col>
            <Col>
              <NumberField label="Red card fine" value={draft.redCardFine} onChange={(v) => set("redCardFine", v)} suffix="₦" hint={formatNaira(draft.redCardFine || 0)} disabled={off} />
            </Col>
          </FieldRow>
          <SwitchRow
            label="Fine cards shown during match day"
            hint="When a match day ends, every card given to a squad player becomes a fine."
            value={draft.finesFromMatchDay}
            onChange={(v) => set("finesFromMatchDay", v)}
            disabled={off}
          />
        </Section>

        <Section title="Match day" description="Defaults for new match days and games. Games already in progress keep their rules, except the clock length.">
          <FieldRow>
            <Col>
              <NumberField label="Per team" value={draft.matchTeamSize} onChange={(v) => set("matchTeamSize", v)} disabled={off} />
            </Col>
            <Col>
              <NumberField label="Goals to win" value={draft.matchWinGoals} onChange={(v) => set("matchWinGoals", v)} disabled={off} />
            </Col>
            <Col>
              <NumberField label="Length" value={draft.matchGameMinutes} onChange={(v) => set("matchGameMinutes", v)} suffix="min" disabled={off} />
            </Col>
          </FieldRow>
          <Hint>
            A game ends when a team reaches {draft.matchWinGoals || "–"} goal{draft.matchWinGoals === 1 ? "" : "s"} or the {draft.matchGameMinutes || "–"}-minute
            clock runs out, whichever comes first.
          </Hint>
          <View style={styles.gap} />
          <Label>How teams are picked by default</Label>
          <Choice<TeamMode> options={teamModes} value={draft.matchDefaultTeamMode} onChange={(v) => set("matchDefaultTeamMode", v)} disabled={off} />
          <TextField
            label="Default venue"
            value={draft.matchDefaultVenue}
            onChangeText={(v) => set("matchDefaultVenue", v)}
            placeholder="e.g. Zenith Astro, Pitch 2"
            editable={!off}
            hint="Pre-filled when starting a new match day. Leave blank for none."
          />
        </Section>

        <Section title="Player ratings" description="Ratings run from 4.0 to 9.5 and move after every match day based on results and contributions.">
          <SwitchRow
            label="Update ratings automatically"
            hint="When off, ratings only change when you edit a player by hand."
            value={draft.ratingsEnabled}
            onChange={(v) => set("ratingsEnabled", v)}
            disabled={off}
          />
          <FieldRow>
            <Col>
              <NumberField label="New player rating" value={draft.ratingNewPlayer} onChange={(v) => set("ratingNewPlayer", v)} decimal disabled={off} />
            </Col>
            <Col>{n("ratingMaxSwing", "Max move per day", "±")}</Col>
          </FieldRow>

          <Label>Points per game, by position</Label>
          <Choice<Position> options={ratingPositions} value={ratingPosition} onChange={setRatingPosition} />
          <Hint>
            How {positionNames[ratingPosition]} are rated, using each player's main position. Enter every amount as a positive number; the − ones are
            taken away.
          </Hint>
          <View style={styles.gap} />
          {ratingWeightRows.map((row) => (
            <FieldRow key={row[0].key}>
              {row.map((w) => (
                <Col key={`${ratingPosition}-${w.key}`}>
                  <NumberField
                    label={w.label}
                    value={draft.ratingPositions[ratingPosition][w.key]}
                    onChange={(v) => setWeight(w.key, v)}
                    decimal
                    suffix={w.suffix}
                    disabled={off || !draft.ratingsEnabled}
                  />
                </Col>
              ))}
            </FieldRow>
          ))}

          <View style={styles.example}>
            <Txt style={text.semi}>Example, before scaling</Txt>
            <Txt style={[text.small, styles.exampleLine]}>
              A defender who wins 2–0 and assists once:{" "}
              <Txt style={{ color: colors.win }}>
                {signed(draft.ratingPositions.DEF.win + draft.ratingPositions.DEF.cleanSheet + draft.ratingPositions.DEF.assist)}
              </Txt>
            </Txt>
            <Txt style={[text.small, styles.exampleLine]}>
              A forward who scores twice but loses 2–3:{" "}
              <Txt style={{ color: colors.paper }}>
                {signed(draft.ratingPositions.FWD.goal * 2 - draft.ratingPositions.FWD.loss - draft.ratingPositions.FWD.goalConceded * 3)}
              </Txt>
            </Txt>
            <Txt style={[text.small, styles.exampleLine]}>
              A goalkeeper who loses 2–3:{" "}
              <Txt style={{ color: colors.loss }}>{signed(-draft.ratingPositions.GK.loss - draft.ratingPositions.GK.goalConceded * 3)}</Txt>
            </Txt>
            <Txt style={[text.small, styles.exampleLine]}>
              Gains shrink near 9.5 and losses shrink near 4.0, so ratings drift back to the middle unless a player keeps performing.
            </Txt>
          </View>
          {canEdit ? (
            <Pressable onPress={() => setDraft((d) => ({ ...d, ...DEFAULT_RATING_WEIGHTS }))} accessibilityRole="button" hitSlop={8}>
              <Txt style={styles.link}>Restore default points</Txt>
            </Pressable>
          ) : null}
        </Section>

        <Section title="The Vale" description="The weekly awards page: team of the week, player of the week, most improved and the weekly leaders.">
          <SwitchRow
            label="Update awards automatically"
            hint="When a match day ends, rebuild The Vale from its results. Turn off to manage it entirely by hand."
            value={draft.valeAutoAwards}
            onChange={(v) => set("valeAutoAwards", v)}
            disabled={off}
          />
        </Section>

        <Section title="Player portal" description="One shared passcode for the whole squad. It opens the player portal on the web and this app.">
          <TextField
            label="Squad passcode"
            value={passcodeDraft}
            onChangeText={(v) => {
              setPasscodeDraft(v);
              setSaved(false);
            }}
            editable={!off}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.mono}
          />
          <Label>Squad sign-up link</Label>
          <Pressable
            onPress={() => Share.share({ message: `Join the Noisers FC squad: ${SITE_URL}/join` })}
            accessibilityRole="button"
            accessibilityLabel="Share the squad sign-up link"
            style={({ pressed }) => [styles.share, pressed ? { opacity: 0.75 } : null]}
          >
            <Txt style={[styles.mono, styles.flex]} selectable numberOfLines={1}>
              {SITE_URL}/join
            </Txt>
            <Ionicons name="share-outline" size={18} color={colors.paper} />
          </Pressable>
          <Hint>Share this with new players. They add their own name, number and position using the squad passcode.</Hint>
        </Section>

        <MatchRecords />

        <ChangePassword />

        {canEdit ? <DangerZone /> : null}
      </Screen>

      {canEdit && (count > 0 || saved || error) ? (
        <SaveBar
          dirty={count > 0}
          saving={saving}
          error={error}
          message={saved && count === 0 ? "Settings saved" : plural(count, "unsaved change")}
          onSave={save}
          onDiscard={() => {
            setDraft(settings);
            setPasscodeDraft(passcode);
            setError("");
          }}
        />
      ) : null}
    </View>
  );
}

function MatchRecords() {
  const { events } = useClub();
  // Live match days are corrected from the Match Day screen as they run.
  const ended = sortEvents(events).filter((e) => e.status === "ended");
  return (
    <Section
      title="Match records"
      description="Fix a finished match day: correct its details, goals and cards, or delete games that shouldn't count. Stats, fines, ratings and The Vale update to match."
    >
      {ended.length === 0 ? (
        <Txt style={text.small}>No finished match days yet.</Txt>
      ) : (
        <Group>
          {ended.map((event) => {
            const s = matchDaySummary(event);
            return (
              <Row
                key={event.id}
                onPress={() => router.push({ pathname: "/admin/match-record", params: { id: event.id } })}
                accessibilityLabel={`Edit ${event.title}`}
              >
                <View style={styles.flex}>
                  <Txt style={text.semi} numberOfLines={1}>
                    {event.title}
                  </Txt>
                  <Txt style={text.small} numberOfLines={1}>
                    {[event.date, plural(s.games, "game"), plural(s.goals, "goal"), plural(s.cards, "card")].join(" · ")}
                  </Txt>
                </View>
              </Row>
            );
          })}
        </Group>
      )}
    </Section>
  );
}

// Saved on its own button, not the settings save bar — a password isn't a
// club setting, and every signed-in account can change its own.
function ChangePassword() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!user) return null;

  async function submit() {
    setDone(false);
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      setError("The new password needs at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await apiFetch("/user/password", {
        method: "PUT",
        body: { current_password: current, password: next, password_confirmation: confirm },
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't change your password."));
    } finally {
      setSaving(false);
    }
  }

  const secure = { secureTextEntry: true, autoCapitalize: "none", autoCorrect: false } as const;

  return (
    <Section
      title="Your account"
      description={`Change the password for ${user.email}. You'll need your current password. Other devices signed in to this account are signed out.`}
    >
      <TextField label="Current password" value={current} onChangeText={setCurrent} autoComplete="current-password" textContentType="password" {...secure} />
      <TextField label="New password" value={next} onChangeText={setNext} autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters." {...secure} />
      <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" textContentType="newPassword" {...secure} />
      <FormError message={error} />
      {done ? <Hint tone={colors.win}>Password changed.</Hint> : null}
      <Button label="Change password" onPress={submit} busy={saving} />
    </Section>
  );
}

function DangerZone() {
  const { events, removeEvent } = useClub();
  const [error, setError] = useState("");
  return (
    <Section
      title="Danger zone"
      tone="danger"
      description="Delete a match day and everything it counted towards: appearances, goals, assists, clean sheets, its cards and fines, and the rating changes it made. This can't be undone."
    >
      <ErrorBanner message={error} />
      {events.length === 0 ? (
        <Txt style={text.small}>No match days recorded.</Txt>
      ) : (
        <Group>
          {sortEvents(events).map((event) => {
            const s = matchDaySummary(event);
            return (
              <Row key={event.id} onPress={() => confirmRemoveEvent(event, removeEvent, setError)} chevron={false} accessibilityLabel={`Delete ${event.title}`}>
                <View style={styles.flex}>
                  <View style={styles.titleLine}>
                    <Txt style={[text.semi, styles.shrink]} numberOfLines={1}>
                      {event.title}
                    </Txt>
                    {event.status === "live" ? <LiveTag /> : null}
                  </View>
                  <Txt style={text.small} numberOfLines={1}>
                    {[event.date, plural(s.games, "game"), plural(s.goals, "goal"), plural(s.cards, "card")].join(" · ")}
                  </Txt>
                </View>
                <Txt style={styles.delete}>Delete</Txt>
              </Row>
            );
          })}
        </Group>
      )}
    </Section>
  );
}

export default function SettingsScreen() {
  const { user } = useAuth();
  const { loading } = useClub();
  const [passcode, setPasscode] = useState<string | null>(null);

  // The passcode isn't in the public settings, so it's fetched on its own.
  useEffect(() => {
    apiFetch<{ passcode: string }>("/settings/passcode")
      .then((res) => setPasscode(res.passcode))
      .catch(() => setPasscode(""));
  }, []);

  if (loading || passcode === null) {
    return (
      <Screen>
        <Loading label="Loading settings…" />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <SettingsForm canEdit={user?.role === "admin"} passcode={passcode} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  gap: { height: space.lg },
  notice: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
  example: { backgroundColor: colors.ink, borderRadius: 12, padding: space.md, marginBottom: space.md },
  exampleLine: { marginTop: 4, lineHeight: 17 },
  link: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim, textDecorationLine: "underline" },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), letterSpacing: 1, color: colors.paper },
  share: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48, backgroundColor: colors.ink, borderRadius: 12, borderWidth: 1, borderColor: colors.inkLine, paddingHorizontal: space.md },
  titleLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  delete: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.loss },
});
