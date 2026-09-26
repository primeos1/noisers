import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { errorMessage } from "../../lib/api";
import { resolveMediaUrl } from "../../lib/config";
import { LIVE_STATS, useHomeContent, type HomeContentPatch } from "../../lib/content";
import { pickAndUploadImage } from "../../lib/media";
import type { HomeContent, LiveStatId } from "../../lib/types";
import { confirm, FormError, formStyles, Hint, ImageField, Label, SaveBar, Section, TextField, Intro } from "../../components/form";
import { ErrorBanner, Loading, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

type TextSections = Pick<HomeContent, "hero" | "story" | "atmosphere" | "matchday" | "footer"> & {
  statsSection: { eyebrow: string; headline: string };
};

function textDraft(c: HomeContent): TextSections {
  return {
    hero: c.hero,
    story: c.story,
    atmosphere: c.atmosphere,
    matchday: c.matchday,
    footer: c.footer,
    statsSection: { eyebrow: c.statsSection.eyebrow ?? "", headline: c.statsSection.headline ?? "" },
  };
}

function HomeForm({ home }: { home: ReturnType<typeof useHomeContent> }) {
  const { content, update } = home;
  const [draft, setDraft] = useState(() => textDraft(content));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [liveError, setLiveError] = useState("");
  const [statsImage, setStatsImage] = useState(content.statsSection.imageUrl ?? "");

  function edit<K extends keyof TextSections>(section: K, patch: Partial<TextSections[K]>) {
    setDraft((d) => ({ ...d, [section]: { ...d[section], ...patch } }));
    setDirty(true);
    setSaved(false);
  }

  // Images save on their own, as on the web. The text save below leaves the
  // image fields out, so it can never send an old URL back.
  function imageCommit<K extends "hero" | "story" | "atmosphere" | "statsSection">(section: K) {
    return (imageUrl: string) => update({ [section]: { imageUrl } } as HomeContentPatch);
  }

  async function saveText() {
    setError("");
    setSaving(true);
    try {
      await update({
        hero: { eyebrow: draft.hero.eyebrow, headline: draft.hero.headline, subtext: draft.hero.subtext },
        story: { eyebrow: draft.story.eyebrow, headline: draft.story.headline, paragraph1: draft.story.paragraph1, paragraph2: draft.story.paragraph2 },
        atmosphere: { caption: draft.atmosphere.caption },
        matchday: draft.matchday,
        footer: draft.footer,
        statsSection: draft.statsSection,
      });
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the Home page."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(enabled: boolean) {
    setLiveError("");
    try {
      await update({ statsSection: { enabled } });
    } catch (err) {
      setLiveError(errorMessage(err, "Couldn't change that."));
    }
  }

  async function toggleLive(id: LiveStatId) {
    const current = content.statsSection.live;
    const live = current.includes(id) ? current.filter((x) => x !== id) : LIVE_STATS.map((s) => s.id).filter((x) => x === id || current.includes(x));
    setLiveError("");
    try {
      await update({ statsSection: { live } });
    } catch (err) {
      setLiveError(errorMessage(err, "Couldn't change that."));
    }
  }

  const stats = content.statsSection;

  return (
    <View style={styles.flex}>
      <Screen onRefresh={home.reload}>
        <Intro>Every piece of copy and imagery on the public homepage. Images, switches, tiles and the gallery go live straight away; text goes live when you press Save.</Intro>

        <Section title="Hero" description="The full-bleed banner at the top of the site.">
          <TextField label="Eyebrow" value={draft.hero.eyebrow} onChangeText={(eyebrow) => edit("hero", { eyebrow })} />
          <TextField label="Headline" value={draft.hero.headline} onChangeText={(headline) => edit("hero", { headline })} />
          <TextField label="Subtext" value={draft.hero.subtext} onChangeText={(subtext) => edit("hero", { subtext })} multiline />
          <ImageField
            label="Background image"
            value={draft.hero.imageUrl}
            onChange={(imageUrl) => setDraft((d) => ({ ...d, hero: { ...d.hero, imageUrl } }))}
            onCommit={imageCommit("hero")}
            maxDim={1800}
            wide
          />
        </Section>

        <Section
          title="Club in numbers"
          description="The band of big numbers under the hero."
          aside={
            <Switch
              value={stats.enabled}
              onValueChange={toggleEnabled}
              accessibilityLabel="Show this section"
              trackColor={{ true: colors.win, false: colors.inkLine }}
              thumbColor={colors.paper}
            />
          }
        >
          <Hint>{stats.enabled ? "Shown on the home page." : "Hidden from the home page."}</Hint>
          <View style={[styles.gap, stats.enabled ? null : styles.dim]}>
            <TextField label="Eyebrow" value={draft.statsSection.eyebrow} onChangeText={(eyebrow) => edit("statsSection", { eyebrow })} placeholder="Club in numbers" />
            <TextField label="Headline" value={draft.statsSection.headline} onChangeText={(headline) => edit("statsSection", { headline })} placeholder="Every session counts." />
            <Label>Live numbers</Label>
            <View style={styles.liveGrid}>
              {LIVE_STATS.map((s) => {
                const on = stats.live.includes(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggleLive(s.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={[styles.liveChip, on ? styles.liveChipOn : null]}
                  >
                    <Ionicons name={on ? "checkmark" : "add"} size={16} color={on ? colors.ink : colors.paperDim} />
                    <Txt style={[styles.liveText, on ? { color: colors.ink } : null]}>{s.label}</Txt>
                  </Pressable>
                );
              })}
            </View>
            <Hint>Worked out from the squad and match days. They update by themselves.</Hint>
            <FormError message={liveError} />
            <View style={styles.gap} />
            <ImageField
              label="Background image"
              value={statsImage}
              onChange={setStatsImage}
              onCommit={imageCommit("statsSection")}
              maxDim={1600}
              wide
            />
          </View>
        </Section>

        <StatTiles home={home} />

        <Section title="Our story">
          <TextField label="Eyebrow" value={draft.story.eyebrow} onChangeText={(eyebrow) => edit("story", { eyebrow })} />
          <TextField label="Headline" value={draft.story.headline} onChangeText={(headline) => edit("story", { headline })} />
          <TextField label="Paragraph 1" value={draft.story.paragraph1} onChangeText={(paragraph1) => edit("story", { paragraph1 })} multiline />
          <TextField label="Paragraph 2" value={draft.story.paragraph2} onChangeText={(paragraph2) => edit("story", { paragraph2 })} multiline />
          <ImageField
            label="Image"
            value={draft.story.imageUrl}
            onChange={(imageUrl) => setDraft((d) => ({ ...d, story: { ...d.story, imageUrl } }))}
            onCommit={imageCommit("story")}
            maxDim={1200}
            wide
          />
        </Section>

        <Section title="Atmosphere break" description="The full-width photo break with a one-line caption.">
          <TextField label="Caption" value={draft.atmosphere.caption} onChangeText={(caption) => edit("atmosphere", { caption })} />
          <ImageField
            label="Image"
            value={draft.atmosphere.imageUrl}
            onChange={(imageUrl) => setDraft((d) => ({ ...d, atmosphere: { ...d.atmosphere, imageUrl } }))}
            onCommit={imageCommit("atmosphere")}
            maxDim={1600}
            wide
          />
        </Section>

        <Section title="How match day works" description="The explainer next to the latest match day teaser.">
          <TextField label="Eyebrow" value={draft.matchday.eyebrow} onChangeText={(eyebrow) => edit("matchday", { eyebrow })} />
          <TextField label="Headline" value={draft.matchday.headline} onChangeText={(headline) => edit("matchday", { headline })} />
          <TextField label="Body" value={draft.matchday.body} onChangeText={(body) => edit("matchday", { body })} multiline />
        </Section>

        <Section title="Footer" description="Shown on every page, site-wide.">
          <TextField label="Tagline" value={draft.footer.tagline} onChangeText={(tagline) => edit("footer", { tagline })} />
          <TextField
            label={`Copyright line (after "© ${new Date().getFullYear()}")`}
            value={draft.footer.copyright}
            onChangeText={(copyright) => edit("footer", { copyright })}
            hint="The year is always added automatically."
          />
        </Section>

        <Gallery home={home} />
      </Screen>

      {dirty || saved || error ? (
        <SaveBar
          dirty={dirty}
          saving={saving}
          error={error}
          message={saved && !dirty ? "Saved — live on the site" : "Unsaved text changes"}
          onSave={saveText}
          onDiscard={() => {
            setDraft(textDraft(content));
            setDirty(false);
            setError("");
          }}
        />
      ) : null}
    </View>
  );
}

/** Custom "Club in numbers" tiles — saved as you finish editing each field. */
function StatTiles({ home }: { home: ReturnType<typeof useHomeContent> }) {
  const { content, addStat, updateStat, removeStat } = home;
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, fallback: string) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  }

  return (
    <Section title="Custom number tiles" description='Your own numbers, shown after the live ones (e.g. "3 · Trophies"). Each change saves when you leave the field.'>
      {content.stats.map((s) => (
        <View key={s.id} style={styles.tileRow}>
          <TextInput
            defaultValue={s.value}
            onEndEditing={(e) => e.nativeEvent.text !== s.value && run(() => updateStat(s.id, { value: e.nativeEvent.text }), "Couldn't save that tile.")}
            style={[formStyles.input, styles.tileValue]}
            accessibilityLabel="Value"
          />
          <TextInput
            defaultValue={s.label}
            onEndEditing={(e) => e.nativeEvent.text !== s.label && run(() => updateStat(s.id, { label: e.nativeEvent.text }), "Couldn't save that tile.")}
            style={[formStyles.input, styles.flex]}
            accessibilityLabel="Label"
          />
          <Pressable
            onPress={() => confirm("Remove tile?", `"${s.value} · ${s.label}" comes off the home page.`, "Remove", () => run(() => removeStat(s.id), "Couldn't remove that tile."))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${s.label}`}
          >
            <Ionicons name="trash-outline" size={20} color={colors.mist} />
          </Pressable>
        </View>
      ))}
      <View style={styles.tileRow}>
        <TextInput value={value} onChangeText={setValue} placeholder="14" placeholderTextColor={colors.mist} style={[formStyles.input, styles.tileValue]} accessibilityLabel="New tile value" />
        <TextInput value={label} onChangeText={setLabel} placeholder="Wins this season" placeholderTextColor={colors.mist} style={[formStyles.input, styles.flex]} accessibilityLabel="New tile label" />
        <Pressable
          onPress={() =>
            value.trim() &&
            label.trim() &&
            run(async () => {
              await addStat({ value: value.trim(), label: label.trim() });
              setValue("");
              setLabel("");
            }, "Couldn't add that tile.")
          }
          disabled={!value.trim() || !label.trim()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add tile"
        >
          <Ionicons name="add-circle" size={26} color={value.trim() && label.trim() ? colors.paper : colors.inkLine} />
        </Pressable>
      </View>
      <FormError message={error} />
    </Section>
  );
}

function Gallery({ home }: { home: ReturnType<typeof useHomeContent> }) {
  const { content, addGalleryImage, removeGalleryImage } = home;
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>, fallback: string) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, fallback));
    }
  }

  async function upload() {
    setBusy(true);
    await run(async () => {
      const media = await pickAndUploadImage(1200);
      if (media) await addGalleryImage(media.url);
    }, "Couldn't upload that image.");
    setBusy(false);
  }

  return (
    <Section title="Gallery strip" description={'The "On the pitch" photo strip on the homepage. Long-press a photo to remove it.'}>
      <View style={styles.gallery}>
        {content.gallery.map((g) => (
          <Pressable
            key={g.id}
            onLongPress={() => confirm("Remove photo?", "It comes off the home page gallery.", "Remove", () => run(() => removeGalleryImage(g.id), "Couldn't remove that image."))}
            accessibilityLabel={g.alt ?? "Gallery photo"}
            accessibilityHint="Long-press to remove"
            style={styles.galleryItem}
          >
            <Image source={{ uri: resolveMediaUrl(g.imageUrl) ?? undefined }} style={styles.galleryImage} contentFit="cover" transition={150} />
          </Pressable>
        ))}
        <Pressable onPress={upload} disabled={busy} accessibilityRole="button" accessibilityLabel="Upload a photo" style={[styles.galleryItem, styles.galleryAdd]}>
          <Ionicons name={busy ? "hourglass-outline" : "add"} size={26} color={colors.paperDim} />
          <Txt style={text.small}>{busy ? "Uploading…" : "Upload"}</Txt>
        </Pressable>
      </View>
      <View style={styles.tileRow}>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="…or paste an image URL"
          placeholderTextColor={colors.mist}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[formStyles.input, styles.flex]}
          accessibilityLabel="Image URL"
        />
        <Pressable
          onPress={() =>
            url.trim() &&
            run(async () => {
              await addGalleryImage(url.trim());
              setUrl("");
            }, "Couldn't add that image.")
          }
          disabled={!url.trim()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add image URL"
        >
          <Ionicons name="add-circle" size={26} color={url.trim() ? colors.paper : colors.inkLine} />
        </Pressable>
      </View>
      <FormError message={error} />
    </Section>
  );
}

export default function HomeContentScreen() {
  const home = useHomeContent();

  if (home.loading) {
    return (
      <Screen>
        <Loading label="Loading the Home page…" />
      </Screen>
    );
  }
  if (home.error) {
    return (
      <Screen onRefresh={home.reload}>
        <ErrorBanner message={home.error} onRetry={home.reload} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <HomeForm home={home} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { marginTop: space.md },
  dim: { opacity: 0.5 },
  liveGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  liveChip: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.inkLine, backgroundColor: colors.ink, paddingHorizontal: space.md },
  liveChipOn: { backgroundColor: colors.paper, borderColor: colors.paper },
  liveText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim },
  tileRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  tileValue: { width: 76 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
  galleryItem: { width: "31%", aspectRatio: 1, borderRadius: radius.sm, overflow: "hidden" },
  galleryImage: { width: "100%", height: "100%", backgroundColor: colors.inkLine },
  galleryAdd: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.inkLine, alignItems: "center", justifyContent: "center", gap: 2 },
});
