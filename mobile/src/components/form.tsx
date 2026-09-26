// Form building blocks for the committee screens — labelled inputs, number
// fields, switches, choice chips, a shirt-number player picker and an image
// field that uploads from the photo library. Styled like SignInForm.

import { useState, type ReactNode } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, type TextInputProps } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../lib/api";
import { resolveMediaUrl } from "../lib/config";
import { pickAndUploadImage } from "../lib/media";
import { plural } from "../lib/derive";
import type { MatchDayEvent, Player } from "../lib/types";
import { colors, fonts, radius, space } from "../theme";
import { Txt, text } from "./ui";

/** Ask before something destructive. Web has no Alert buttons, so it just runs. */
export function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(`${title}\n\n${message}`) ?? true) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

export function matchDaySummary(event: MatchDayEvent) {
  const finished = event.games.filter((g) => g.status === "finished");
  return {
    games: finished.length,
    goals: finished.reduce((n, g) => n + g.goals.length, 0),
    cards: event.games.reduce((n, g) => n + g.cards.length, 0),
  };
}

/** Removing a match day also undoes everything it fed into, so say so. */
export function confirmRemoveEvent(event: MatchDayEvent, remove: (id: string) => Promise<void>, onError: (message: string) => void) {
  const s = matchDaySummary(event);
  confirm(
    "Delete match day?",
    `"${event.title}" and everything it counted towards goes:\n\n• ${plural(s.games, "finished game")} and ${plural(s.goals, "goal")} come off players' stats\n• ${plural(s.cards, "card")} and their fines are removed\n• Ratings move back to where they were\n\nThis can't be undone.`,
    "Delete",
    () => remove(event.id).catch((err) => onError(errorMessage(err, "Couldn't delete that match day."))),
  );
}

/** A raised card grouping one part of a form, with a heading. */
export function Section({
  title,
  description,
  aside,
  tone = "default",
  children,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, tone === "danger" ? styles.sectionDanger : null]}>
      <View style={styles.sectionHead}>
        <Txt style={[styles.sectionTitle, tone === "danger" ? { color: colors.loss } : null]} accessibilityRole="header">
          {title}
        </Txt>
        {aside}
      </View>
      {description ? <Txt style={[text.small, styles.sectionDesc]}>{description}</Txt> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** One-line explainer under a screen's native header (which already shows the title). */
export function Intro({ children }: { children: ReactNode }) {
  return <Txt style={styles.intro}>{children}</Txt>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Txt style={styles.label}>{children}</Txt>;
}

export function Hint({ children, tone }: { children: ReactNode; tone?: string }) {
  return <Txt style={[text.small, styles.hint, tone ? { color: tone } : null]}>{children}</Txt>;
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Txt style={styles.error} accessibilityRole="alert">
      {message}
    </Txt>
  );
}

export function TextField({
  label,
  hint,
  multiline,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={colors.mist}
        accessibilityLabel={label}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : undefined}
        {...props}
        style={[styles.input, multiline ? styles.textarea : null, props.editable === false ? styles.disabled : null, style]}
      />
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

/**
 * A number input that keeps the typed text (so "0." or "" can be mid-edit)
 * and reports NaN while it isn't a number.
 */
export function NumberField({
  label,
  value,
  onChange,
  decimal = false,
  suffix,
  hint,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimal?: boolean;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(Number.isNaN(value) ? "" : String(value));
  // Follow outside changes (e.g. "Restore defaults") without fighting typing.
  const shown = Number(draft) === value || (draft === "" && Number.isNaN(value)) ? draft : String(value);

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View>
        <TextInput
          value={shown}
          editable={!disabled}
          onChangeText={(t) => {
            const clean = t.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
            setDraft(clean);
            onChange(clean === "" ? NaN : Number(clean));
          }}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          accessibilityLabel={label}
          style={[styles.input, suffix ? styles.inputSuffixed : null, disabled ? styles.disabled : null]}
        />
        {suffix ? <Txt style={styles.suffix}>{suffix}</Txt> : null}
      </View>
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

/** Two or three fields side by side. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

export function Col({ children }: { children: ReactNode }) {
  return <View style={styles.col}>{children}</View>;
}

export function SwitchRow({
  label,
  hint,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.switchRow, disabled ? styles.disabled : null]}>
      <View style={styles.flex}>
        <Txt style={text.body}>{label}</Txt>
        {hint ? <Txt style={[text.small, styles.switchHint]}>{hint}</Txt> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.win, false: colors.inkLine }}
        thumbColor={colors.paper}
      />
    </View>
  );
}

/** Pick one of a few options; wraps onto more lines if needed. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string; hint?: string; tone?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.choices} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            style={({ pressed }) => [
              styles.choice,
              active ? styles.choiceActive : null,
              pressed ? styles.pressed : null,
              disabled ? styles.disabled : null,
            ]}
          >
            <Txt style={[styles.choiceText, active ? styles.choiceTextActive : null, !active && o.tone ? { color: o.tone } : null]} numberOfLines={1}>
              {o.label}
            </Txt>
            {o.hint ? (
              <Txt style={[text.small, active ? { color: colors.ink, opacity: 0.7 } : null]} numberOfLines={2}>
                {o.hint}
              </Txt>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Horizontal strip of shirt numbers, with the chosen player's name below.
 * `allowNone` adds a "None" chip (value 0).
 */
export function ShirtPicker({
  players,
  value,
  onChange,
  allowNone = false,
  label,
}: {
  players: Player[];
  value: number;
  onChange: (playerId: number) => void;
  allowNone?: boolean;
  label?: string;
}) {
  const squad = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  const selected = squad.find((p) => p.id === value);
  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shirts} keyboardShouldPersistTaps="handled">
        {allowNone ? (
          <Pressable
            onPress={() => onChange(0)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === 0 }}
            accessibilityLabel="None"
            style={[styles.shirt, value === 0 ? styles.shirtActive : null]}
          >
            <Txt style={[styles.shirtNone, value === 0 ? styles.shirtNumberActive : null]}>None</Txt>
          </Pressable>
        ) : null}
        {squad.map((p) => {
          const active = p.id === value;
          return (
            <Pressable
              key={p.id}
              onPress={() => onChange(p.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${p.name}, number ${p.number}`}
              style={[styles.shirt, active ? styles.shirtActive : null]}
            >
              <Txt style={[styles.shirtNumber, active ? styles.shirtNumberActive : null]}>{p.number}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <Txt style={[text.dim, styles.shirtName]}>{selected ? selected.name : value ? "Former player" : allowNone ? "No one" : "Tap a shirt number"}</Txt>
    </View>
  );
}

/** Tick any number of players — used for lineups and clean-sheet lists. */
export function ShirtMultiPicker({
  players,
  value,
  onChange,
  label,
}: {
  players: Player[];
  value: number[];
  onChange: (playerIds: number[]) => void;
  label?: string;
}) {
  const squad = [...players].sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
  const names = value.map((id) => squad.find((p) => p.id === id)?.name ?? "Former player");
  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <View style={styles.shirtGrid}>
        {squad.map((p) => {
          const active = value.includes(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => onChange(active ? value.filter((id) => id !== p.id) : [...value, p.id])}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${p.name}, number ${p.number}`}
              style={[styles.shirt, active ? styles.shirtActive : null]}
            >
              <Txt style={[styles.shirtNumber, active ? styles.shirtNumberActive : null]}>{p.number}</Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt style={[text.dim, styles.shirtName]}>{names.length ? names.join(", ") : "No one picked"}</Txt>
    </View>
  );
}

/**
 * One image: a preview, "Upload from photos", and a URL field. With
 * `onCommit`, the image saves by itself as soon as it's uploaded.
 */
export function ImageField({
  label,
  value,
  onChange,
  onCommit,
  maxDim = 1600,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onCommit?: (url: string) => Promise<void>;
  maxDim?: number;
  wide?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const uri = resolveMediaUrl(value);

  async function commit(url: string) {
    if (!onCommit) return;
    await onCommit(url);
    setStatus("Saved — live on the site");
    setTimeout(() => setStatus(""), 2500);
  }

  async function upload() {
    setError("");
    setBusy(true);
    try {
      const media = await pickAndUploadImage(maxDim);
      if (media) {
        onChange(media.url);
        await commit(media.url);
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't upload that image."));
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setError("");
    onChange("");
    try {
      await commit("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that image."));
    }
  }

  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={styles.imageRow}>
        {uri ? (
          <Image source={{ uri }} style={[styles.preview, wide ? styles.previewWide : null]} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.preview, wide ? styles.previewWide : null, styles.previewEmpty]}>
            <Ionicons name="image-outline" size={22} color={colors.mist} />
          </View>
        )}
        <View style={styles.imageActions}>
          <Pressable onPress={upload} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.smallButton, pressed ? styles.pressed : null]}>
            <Ionicons name={busy ? "hourglass-outline" : "cloud-upload-outline"} size={16} color={colors.paper} />
            <Txt style={styles.smallButtonText}>{busy ? "Uploading…" : "Upload from photos"}</Txt>
          </Pressable>
          {value ? (
            <Pressable onPress={clear} hitSlop={6} accessibilityRole="button">
              <Txt style={[text.small, { color: colors.loss }]}>{onCommit ? "Use default" : "Remove"}</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
      {status ? <Hint tone={colors.win}>{status}</Hint> : null}
      {error ? <Hint tone={colors.loss}>{error}</Hint> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        onEndEditing={(e) => {
          const url = e.nativeEvent.text.trim();
          if (onCommit) commit(url).catch((err) => setError(errorMessage(err, "Couldn't save that image.")));
        }}
        placeholder="…or paste an image URL"
        placeholderTextColor={colors.mist}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        accessibilityLabel={`${label} URL`}
        style={[styles.input, styles.urlInput]}
      />
    </View>
  );
}

/** A floating bar pinned above the bottom of the screen for Save / Discard. */
export function SaveBar({
  message,
  error,
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = "Save",
}: {
  message: string;
  error?: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.saveBar, { paddingBottom: insets.bottom + space.md }]}>
      <Txt style={[text.small, styles.flex, { color: error ? colors.loss : colors.paperDim }]} numberOfLines={2}>
        {error || message}
      </Txt>
      {dirty && onDiscard ? (
        <Pressable onPress={onDiscard} disabled={saving} hitSlop={8} accessibilityRole="button">
          <Txt style={styles.discard}>Discard</Txt>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onSave}
        disabled={!dirty || saving}
        accessibilityRole="button"
        style={[styles.saveButton, !dirty || saving ? styles.disabled : null]}
      >
        <Txt style={styles.saveText}>{saving ? "Saving…" : saveLabel}</Txt>
      </Pressable>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  input: {
    minHeight: 48,
    backgroundColor: colors.ink,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inkLine,
    paddingHorizontal: space.md,
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },

  section: { backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg, borderWidth: 1, borderColor: colors.inkLine },
  sectionDanger: { borderColor: "rgba(194,59,107,0.4)" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.paper, flexShrink: 1 },
  sectionDesc: { marginTop: 4, lineHeight: 17, fontSize: 13 },
  sectionBody: { marginTop: space.lg },

  intro: { fontSize: 14, lineHeight: 20, color: colors.paperDim, marginBottom: space.lg, paddingHorizontal: 2 },
  field: { marginBottom: space.lg },
  fieldRow: { flexDirection: "row", gap: space.md },
  col: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim, marginBottom: 6 },
  hint: { marginTop: 6, lineHeight: 16 },
  error: { color: colors.loss, fontSize: 14, marginBottom: space.md },

  input: { ...formStyles.input },
  textarea: { minHeight: 110, paddingTop: space.md, paddingBottom: space.md },
  inputSuffixed: { paddingRight: 44 },
  suffix: { position: "absolute", right: space.md, top: 15, fontSize: 13, color: colors.mist },
  urlInput: { marginTop: space.sm, fontSize: 14 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: space.md, marginBottom: space.md },
  switchHint: { marginTop: 2, lineHeight: 16 },

  choices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg },
  choice: { flexGrow: 1, flexBasis: "30%", minHeight: 44, justifyContent: "center", backgroundColor: colors.ink, borderRadius: 12, borderWidth: 1, borderColor: colors.inkLine, paddingHorizontal: space.md, paddingVertical: space.sm },
  choiceActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  choiceText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim },
  choiceTextActive: { color: colors.ink },

  shirts: { gap: space.sm, paddingBottom: 4 },
  shirtGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  shirt: { minWidth: 46, height: 46, borderRadius: 23, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.inkLine },
  shirtActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  shirtNumber: { fontFamily: fonts.display, fontSize: 19, color: colors.paper },
  shirtNone: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim },
  shirtNumberActive: { color: colors.ink },
  shirtName: { marginTop: space.sm, paddingHorizontal: 2 },

  imageRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  preview: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.inkLine },
  previewWide: { width: 112 },
  previewEmpty: { alignItems: "center", justifyContent: "center" },
  imageActions: { flex: 1, gap: space.sm, alignItems: "flex-start" },
  smallButton: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.inkLine, paddingHorizontal: space.md, paddingVertical: 8 },
  smallButtonText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper },

  saveBar: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.inkRaised, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine, paddingHorizontal: space.lg, paddingTop: space.md },
  discard: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim },
  saveButton: { backgroundColor: colors.paper, borderRadius: radius.pill, paddingHorizontal: space.xl, paddingVertical: 10 },
  saveText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
});
