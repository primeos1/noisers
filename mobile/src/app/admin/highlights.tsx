import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../lib/api";
import { resolveMediaUrl } from "../../lib/config";
import { HIGHLIGHT_CATEGORIES, useHighlights, type HighlightInput } from "../../lib/content";
import type { Highlight, HighlightCategory, MediaType } from "../../lib/types";
import { Choice, confirm, FormError, ImageField, Label, SwitchRow, TextField } from "../../components/form";
import { Button, Empty, ErrorBanner, Loading, PageTitle, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, radius, space } from "../../theme";

function HighlightForm({
  initial,
  onClose,
  onSubmit,
  onRemove,
}: {
  initial: Highlight | null;
  onClose: () => void;
  onSubmit: (input: HighlightInput) => Promise<void>;
  onRemove?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<MediaType>(initial?.type ?? "photo");
  const [mediaUrl, setMediaUrl] = useState(initial?.src ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [alt, setAlt] = useState(initial?.alt ?? "");
  const [category, setCategory] = useState<HighlightCategory>(initial?.category ?? HIGHLIGHT_CATEGORIES[0]);
  const [tall, setTall] = useState(initial?.tall ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!mediaUrl.trim() || !caption.trim()) {
      setError("Add an image and a caption.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({ type, mediaUrl: mediaUrl.trim(), caption: caption.trim(), alt: alt.trim(), category, tall });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that highlight."));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.sheetHead}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
          <Txt style={styles.sheetAction}>Cancel</Txt>
        </Pressable>
        <Txt style={styles.sheetTitle}>{initial ? "Edit highlight" : "Add highlight"}</Txt>
        <View style={styles.sheetSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Label>Type</Label>
        <Choice<MediaType>
          value={type}
          onChange={setType}
          options={[
            { value: "photo", label: "Photo" },
            { value: "video", label: "Video" },
          ]}
        />
        <ImageField label={type === "video" ? "Video URL / thumbnail" : "Image"} value={mediaUrl} onChange={setMediaUrl} maxDim={1200} wide />
        <TextField label="Caption" value={caption} onChangeText={setCaption} placeholder="Idehen's second of the afternoon" />
        <TextField label="Alt text" value={alt} onChangeText={setAlt} placeholder="Describe the image for screen readers" />
        <Label>Category</Label>
        <Choice<HighlightCategory> value={category} onChange={setCategory} options={HIGHLIGHT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <SwitchRow label="Tall tile" hint="Spans two rows in the gallery grid." value={tall} onChange={setTall} />
        <FormError message={error} />
        <Button label={initial ? "Save changes" : "Add highlight"} onPress={submit} busy={busy} />
        {onRemove ? (
          <View style={styles.remove}>
            <Button label="Remove highlight" variant="danger" icon="trash-outline" onPress={onRemove} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function HighlightsScreen() {
  const { highlights, loading, error, reload, add, update, remove } = useHighlights();
  const [editing, setEditing] = useState<Highlight | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  function confirmRemove(item: Highlight) {
    confirm("Remove highlight?", `Remove "${item.caption ?? "this highlight"}"? This can't be undone.`, "Remove", async () => {
      setActionError("");
      setEditing(null);
      try {
        await remove(item.id);
      } catch (err) {
        setActionError(errorMessage(err, "Couldn't remove that highlight."));
      }
    });
  }

  return (
    <Screen onRefresh={reload}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => setEditing("new")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add highlight">
              <Ionicons name="add" size={26} color={colors.paper} />
            </Pressable>
          ),
        }}
      />
      <PageTitle title="Highlights" sub="The photo and video gallery on the public Highlights page. Tap one to edit it." />
      <ErrorBanner message={error || actionError} onRetry={error ? reload : undefined} />

      {loading ? (
        <Loading label="Loading highlights…" />
      ) : highlights.length === 0 ? (
        <Empty action={<Button label="Add highlight" icon="add" onPress={() => setEditing("new")} />}>No highlights yet. Add the first one.</Empty>
      ) : (
        <View style={styles.grid}>
          {highlights.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => setEditing(h)}
              onLongPress={() => confirmRemove(h)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${h.caption ?? "highlight"}`}
              style={({ pressed }) => [styles.tile, pressed ? { opacity: 0.8 } : null]}
            >
              <Image source={{ uri: resolveMediaUrl(h.src) ?? undefined }} style={styles.image} contentFit="cover" transition={150} accessibilityLabel={h.alt ?? undefined} />
              {h.type === "video" ? (
                <View style={styles.badge}>
                  <Ionicons name="play" size={12} color={colors.paper} />
                </View>
              ) : null}
              <View style={styles.meta}>
                <Txt style={text.semi} numberOfLines={1}>
                  {h.caption}
                </Txt>
                <Txt style={text.small} numberOfLines={1}>
                  {h.category}
                  {h.tall ? " · Tall" : ""}
                </Txt>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Modal visible={editing !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(null)}>
        <View style={styles.sheet}>
          {editing !== null ? (
            <HighlightForm
              key={editing === "new" ? "new" : editing.id}
              initial={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSubmit={(input) => (editing === "new" ? add(input) : update(editing.id, input))}
              onRemove={editing === "new" ? undefined : () => confirmRemove(editing)}
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: { width: "47.5%", backgroundColor: colors.inkRaised, borderRadius: radius.md, overflow: "hidden" },
  image: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.inkLine },
  badge: { position: "absolute", top: space.sm, right: space.sm, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(10,14,26,0.7)", alignItems: "center", justifyContent: "center" },
  meta: { padding: space.md, gap: 2 },

  sheet: { flex: 1, backgroundColor: colors.ink },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingVertical: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.inkLine },
  sheetTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.paper },
  sheetAction: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.paperDim },
  sheetSpacer: { width: 50 },
  sheetBody: { padding: space.lg },
  remove: { marginTop: space.md },
});
