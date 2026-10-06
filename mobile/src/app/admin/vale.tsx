import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { useValeContent, type BadBoy, type ValeContent } from "../../lib/content";
import { Col, FieldRow, ImageField, NumberField, SaveBar, Section, ShirtMultiPicker, ShirtPicker, TextField, Intro } from "../../components/form";
import { Button, ErrorBanner, Loading, Screen } from "../../components/ui";

function ValeForm({ initial, save }: { initial: ValeContent; save: (next: ValeContent) => Promise<void> }) {
  const { players, settings } = useClub();
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const team = draft.teamOfTheWeek;
  const potw = draft.playerOfTheWeek;
  const improved = draft.mostImproved;
  const flop = draft.flopOfTheWeek;
  const leaders = draft.weeklyLeaders;

  function editBadBoy(index: number, patch: Partial<BadBoy>) {
    editLeader(
      "badBoys",
      leaders.badBoys.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  }

  function edit<K extends keyof ValeContent>(key: K, patch: Partial<ValeContent[K]>) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
    setDirty(true);
    setSaved(false);
  }

  function editLeader<K extends keyof ValeContent["weeklyLeaders"]>(key: K, value: ValeContent["weeklyLeaders"][K]) {
    edit("weeklyLeaders", { [key]: value } as Partial<ValeContent["weeklyLeaders"]>);
  }

  async function submit() {
    setError("");
    setSaving(true);
    try {
      await save(draft);
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save The Vale."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Screen>
        <Intro>
          {settings.valeAutoAwards
            ? "This week's awards. They're rebuilt automatically when a match day ends; edit them here to adjust."
            : "This week's awards. Automatic updates are off in Settings, so update these after every set."}
        </Intro>

        <Section title="Team of the week">
          <FieldRow>
            <Col>
              <TextField label="Week label" value={team.week} onChangeText={(week) => edit("teamOfTheWeek", { week })} placeholder="Week 12" />
            </Col>
            <Col>
              <TextField label="Date range" value={team.dateRange} onChangeText={(dateRange) => edit("teamOfTheWeek", { dateRange })} placeholder="15–21 Sep" />
            </Col>
          </FieldRow>
          <FieldRow>
            <Col>
              <NumberField label="Sessions won" value={team.sessionsWon} onChange={(sessionsWon) => edit("teamOfTheWeek", { sessionsWon })} />
            </Col>
            <Col>
              <NumberField label="Sessions played" value={team.sessionsPlayed} onChange={(sessionsPlayed) => edit("teamOfTheWeek", { sessionsPlayed })} />
            </Col>
          </FieldRow>
          <FieldRow>
            <Col>
              <TextField label="Rival team" value={team.rivalTeam} onChangeText={(rivalTeam) => edit("teamOfTheWeek", { rivalTeam })} placeholder="Team Blue" />
            </Col>
            <Col>
              <TextField label="Score" value={team.score} onChangeText={(score) => edit("teamOfTheWeek", { score })} placeholder="2–1" />
            </Col>
          </FieldRow>
          <ShirtMultiPicker label="Lineup" players={players} value={team.lineupPlayerIds} onChange={(lineupPlayerIds) => edit("teamOfTheWeek", { lineupPlayerIds })} />
          <ImageField label="Photo" value={team.photo} onChange={(photo) => edit("teamOfTheWeek", { photo })} maxDim={1200} wide />
        </Section>

        <Section title="Player of the week">
          <ShirtPicker label="Player" players={players} value={potw.playerId} onChange={(playerId) => edit("playerOfTheWeek", { playerId })} allowNone />
          <NumberField label="Week rating" value={potw.weekRating} onChange={(weekRating) => edit("playerOfTheWeek", { weekRating })} decimal />
          <TextField label="Note" value={potw.note} onChangeText={(note) => edit("playerOfTheWeek", { note })} multiline />
        </Section>

        <Section title="Most improved player">
          <ShirtPicker label="Player" players={players} value={improved.playerId} onChange={(playerId) => edit("mostImproved", { playerId })} allowNone />
          <FieldRow>
            <Col>
              <NumberField label="Previous rating" value={improved.previousRating} onChange={(previousRating) => edit("mostImproved", { previousRating })} decimal />
            </Col>
            <Col>
              <NumberField label="Current rating" value={improved.currentRating} onChange={(currentRating) => edit("mostImproved", { currentRating })} decimal />
            </Col>
          </FieldRow>
          <TextField label="Note" value={improved.note} onChangeText={(note) => edit("mostImproved", { note })} multiline />
        </Section>

        <Section title="Flop player of the week">
          <ShirtPicker label="Player" players={players} value={flop.playerId} onChange={(playerId) => edit("flopOfTheWeek", { playerId })} allowNone />
          <TextField label="Note" value={flop.note} onChangeText={(note) => edit("flopOfTheWeek", { note })} multiline />
        </Section>

        <Section title="Weekly leaders">
          <ShirtPicker
            label="Top scorer"
            players={players}
            value={leaders.topScorer.playerId}
            onChange={(playerId) => editLeader("topScorer", { ...leaders.topScorer, playerId })}
            allowNone
          />
          <NumberField label="Goals" value={leaders.topScorer.value} onChange={(value) => editLeader("topScorer", { ...leaders.topScorer, value })} />
          <ShirtPicker
            label="Top assist"
            players={players}
            value={leaders.topAssist.playerId}
            onChange={(playerId) => editLeader("topAssist", { ...leaders.topAssist, playerId })}
            allowNone
          />
          <NumberField label="Assists" value={leaders.topAssist.value} onChange={(value) => editLeader("topAssist", { ...leaders.topAssist, value })} />
          <ShirtPicker
            label="Top saves"
            players={players}
            value={leaders.topSaves.playerId}
            onChange={(playerId) => editLeader("topSaves", { ...leaders.topSaves, playerId })}
            allowNone
          />
          <NumberField label="Saves" value={leaders.topSaves.value} onChange={(value) => editLeader("topSaves", { ...leaders.topSaves, value })} />
          <FieldRow>
            <Col>
              <TextField label="Clean sheet team" value={leaders.cleanSheetTeam.name} onChangeText={(name) => editLeader("cleanSheetTeam", { ...leaders.cleanSheetTeam, name })} />
            </Col>
            <Col>
              <NumberField label="Clean sheets" value={leaders.cleanSheetTeam.value} onChange={(value) => editLeader("cleanSheetTeam", { ...leaders.cleanSheetTeam, value })} />
            </Col>
          </FieldRow>
          <ShirtMultiPicker label="Clean sheet team players" players={players} value={leaders.cleanSheets} onChange={(cleanSheets) => editLeader("cleanSheets", cleanSheets)} />
        </Section>

        <Section title="Bad boys of the week" description="Everyone booked this match day.">
          {leaders.badBoys.map((b, i) => (
            <View key={i} style={styles.badBoy}>
              <ShirtPicker label={`Bad boy ${i + 1}`} players={players} value={b.playerId} onChange={(playerId) => editBadBoy(i, { playerId })} />
              <FieldRow>
                <Col>
                  <NumberField label="Yellow cards" value={b.yellowCards} onChange={(yellowCards) => editBadBoy(i, { yellowCards })} />
                </Col>
                <Col>
                  <NumberField label="Red cards" value={b.redCards} onChange={(redCards) => editBadBoy(i, { redCards })} />
                </Col>
              </FieldRow>
              <Button
                label="Remove"
                variant="danger"
                icon="trash-outline"
                onPress={() =>
                  editLeader(
                    "badBoys",
                    leaders.badBoys.filter((_, j) => j !== i),
                  )
                }
              />
            </View>
          ))}
          <Button label="Add a bad boy" variant="secondary" icon="add" onPress={() => editLeader("badBoys", [...leaders.badBoys, { playerId: 0, yellowCards: 1, redCards: 0 }])} />
        </Section>
      </Screen>

      {dirty || saved || error ? (
        <SaveBar
          dirty={dirty}
          saving={saving}
          error={error}
          message={saved && !dirty ? "The Vale saved" : "Unsaved changes"}
          saveLabel="Save The Vale"
          onSave={submit}
          onDiscard={() => {
            setDraft(initial);
            setDirty(false);
            setError("");
          }}
        />
      ) : null}
    </View>
  );
}

export default function ValeScreen() {
  const { content, loading, error, reload, save } = useValeContent();

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading The Vale…" />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen onRefresh={reload}>
        <ErrorBanner message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <ValeForm initial={content} save={save} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badBoy: { gap: 8, paddingBottom: 12, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.12)" },
});
