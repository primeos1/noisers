import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { errorMessage } from "../../lib/api";
import { EXECUTIVE_GROUPS, useExecutives } from "../../lib/content";
import type { ExecutiveGroup } from "../../lib/types";
import { Choice, FormError, ImageField, Label, Section, TextField, confirm } from "../../components/form";
import { Button, Loading, Screen } from "../../components/ui";
import { space } from "../../theme";

// Add or edit one person on the Executives page (`?id=` to edit).

const TITLE_IDEAS: Record<ExecutiveGroup, string> = {
  executive: "President, Secretary, Treasurer…",
  staff: "Kit manager, Media, Groundsman…",
  disciplinary: "Chair, Member…",
};

export default function ExecutiveScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { executives, loading, add, update, remove } = useExecutives();
  const existing = id ? executives.find((e) => e.id === Number(id)) : undefined;

  if (id && loading) {
    return (
      <Screen>
        <Loading label="Loading…" />
      </Screen>
    );
  }
  return <ExecutiveForm key={existing?.id ?? "new"} existing={existing} add={add} update={update} remove={remove} />;
}

function ExecutiveForm({
  existing,
  add,
  update,
  remove,
}: {
  existing?: ReturnType<typeof useExecutives>["executives"][number];
  add: ReturnType<typeof useExecutives>["add"];
  update: ReturnType<typeof useExecutives>["update"];
  remove: ReturnType<typeof useExecutives>["remove"];
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [group, setGroup] = useState<ExecutiveGroup>(existing?.group ?? "executive");
  const [photo, setPhoto] = useState(existing?.photo ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) return setError("Enter their name.");
    if (!title.trim()) return setError("Enter their title, like President or Kit manager.");
    setBusy(true);
    setError("");
    const input = { name, title, group, photo };
    try {
      if (existing) await update(existing.id, input);
      else await add(input);
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save."));
      setBusy(false);
    }
  }

  function confirmRemove() {
    if (!existing) return;
    confirm(`Remove ${existing.name}?`, "They come off the public Executives page.", "Remove", async () => {
      try {
        await remove(existing.id);
        router.back();
      } catch (err) {
        setError(errorMessage(err, "Couldn't remove them."));
      }
    });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Section title="Who">
          <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Full name" />
          <TextField label="Title" value={title} onChangeText={setTitle} autoCapitalize="words" placeholder={TITLE_IDEAS[group]} />
          <Label>Section</Label>
          <Choice<ExecutiveGroup> value={group} onChange={setGroup} options={EXECUTIVE_GROUPS.map((g) => ({ value: g.id, label: g.singular }))} />
        </Section>
        <Section title="Photo">
          <ImageField label="Portrait" value={photo} onChange={setPhoto} maxDim={1000} />
        </Section>
        <FormError message={error} />
        <Button label={existing ? "Save changes" : "Add to the page"} icon="checkmark" busy={busy} onPress={save} />
        {existing ? (
          <View style={styles.gap}>
            <Button label="Remove" variant="danger" icon="trash-outline" onPress={confirmRemove} />
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { marginTop: space.md },
});
