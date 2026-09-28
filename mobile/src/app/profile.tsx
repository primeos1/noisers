import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../lib/auth";
import { useClub } from "../lib/club";
import { apiFetch, ApiError, errorMessage } from "../lib/api";
import { resolveMediaUrl } from "../lib/config";
import { positionLabel, positions } from "../lib/derive";
import { appendImage, pickImage, type PickedImage } from "../lib/media";
import type { Player, Position } from "../lib/types";
import { Choice, FormError, Hint, Label, NumberField, TextField } from "../components/form";
import { Button, Empty, Screen, Txt, text } from "../components/ui";
import { colors, radius, space } from "../theme";

/**
 * A player editing their own profile (`?id=12`). Players have no accounts,
 * so the save carries the squad passcode that unlocked the app — asked for
 * again only if it's missing or has since changed. Rating and membership
 * stay with the committee.
 */
export default function EditProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { players, replacePlayer } = useClub();
  const { status, squadPasscode, rememberSquadPasscode } = useAuth();
  const player = players.find((p) => p.id === Number(id));
  const staff = status === "signedIn";

  const [name, setName] = useState(player?.name ?? "");
  const [number, setNumber] = useState(player?.number ?? NaN);
  const [position, setPosition] = useState<Position>(player?.position ?? "MID");
  const [secondPosition, setSecondPosition] = useState<Position | "">(player?.secondaryPosition ?? "");
  const [bio, setBio] = useState(player?.bio ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [picking, setPicking] = useState(false);

  const [passcode, setPasscode] = useState("");
  const [askPasscode, setAskPasscode] = useState(!staff && !squadPasscode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!player) {
    return (
      <Screen>
        <Empty>{"We couldn't find that player."}</Empty>
      </Screen>
    );
  }

  const numberOwner = players.find((p) => p.number === number && p.id !== player.id);
  const shownPhoto = photo?.uri ?? (removePhoto ? null : resolveMediaUrl(player.photoUrl));

  async function choosePhoto() {
    setError("");
    setPicking(true);
    try {
      const picked = await pickImage(800);
      if (picked) {
        setPhoto(picked);
        setRemovePhoto(false);
      }
    } catch (err) {
      setError(errorMessage(err, "Couldn't open that photo."));
    } finally {
      setPicking(false);
    }
  }

  async function submit() {
    if (!player) return;
    if (!name.trim()) return setError("Enter your name.");
    if (!Number.isInteger(number) || number < 1 || number > 99) return setError("Your number must be from 1 to 99.");
    if (numberOwner) return setError(`Number ${number} is already taken by ${numberOwner.name}. Pick another number.`);
    const code = askPasscode ? passcode.trim() : (squadPasscode ?? "");
    if (!staff && !code) return setError("Type the squad passcode to save.");

    setBusy(true);
    setError("");
    try {
      // Multipart, so a new photo travels with the rest in one request.
      const form = new FormData();
      if (!staff) form.append("passcode", code);
      form.append("name", name.trim());
      form.append("number", String(number));
      form.append("position", position);
      form.append("secondary_position", secondPosition && secondPosition !== position ? secondPosition : "");
      form.append("bio", bio.trim());
      if (phone.trim()) form.append("phone", phone.trim());
      if (email.trim()) form.append("email", email.trim());
      if (photo) await appendImage(form, "photo", photo);
      else if (removePhoto) form.append("remove_photo", "1");

      const res = await apiFetch<{ data: Player }>(`/players/${player.id}/profile`, { method: "POST", form, timeoutMs: 60000 });
      replacePlayer(res.data);
      if (askPasscode && !staff) await rememberSquadPasscode(code);
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && /passcode/i.test(err.message)) {
        // The passcode was changed since this phone unlocked the app.
        setAskPasscode(true);
        setPasscode("");
      }
      setError(errorMessage(err, "Couldn't save your profile."));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={styles.photoRow}>
          <Pressable onPress={choosePhoto} disabled={picking || busy} accessibilityRole="button" accessibilityLabel="Choose a profile photo">
            {shownPhoto ? (
              <Image source={{ uri: shownPhoto }} style={styles.photo} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]}>
                <Ionicons name="camera-outline" size={28} color={colors.mist} />
              </View>
            )}
          </Pressable>
          <View style={styles.flex}>
            <Txt style={text.semi}>{picking ? "Opening photos…" : shownPhoto ? "Tap the photo to change it" : "Tap to add a photo"}</Txt>
            <Txt style={text.small}>A clear head-and-shoulders shot works best.</Txt>
            {shownPhoto ? (
              <Pressable
                onPress={() => {
                  setPhoto(null);
                  setRemovePhoto(!!player.photoUrl);
                }}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Txt style={[text.small, styles.remove]}>Remove photo</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>

        <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" />

        <NumberField label="Shirt number" value={number} onChange={setNumber} hint={numberOwner ? `Taken by ${numberOwner.name}` : undefined} />

        <Label>Main position</Label>
        <Choice<Position>
          value={position}
          onChange={(next) => {
            setPosition(next);
            if (secondPosition === next) setSecondPosition("");
          }}
          options={positions.map((p) => ({ value: p, label: positionLabel[p] }))}
        />

        <Label>Second position (optional)</Label>
        <Choice<Position | "">
          value={secondPosition}
          onChange={setSecondPosition}
          options={[
            { value: "", label: "None" },
            ...positions.filter((p) => p !== position).map((p) => ({ value: p as Position | "", label: positionLabel[p] })),
          ]}
        />

        <TextField
          label="About you (optional)"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={500}
          placeholder="Favourite position, best goal, pre-match ritual…"
        />

        <TextField label="New phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="Leave blank to keep" />
        <TextField
          label="New email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="Leave blank to keep"
          hint="Only the committee sees your phone and email."
        />

        {askPasscode && !staff ? (
          <TextField label="Squad passcode" value={passcode} onChangeText={setPasscode} secureTextEntry autoCapitalize="none" autoCorrect={false} />
        ) : null}

        <FormError message={error} />
        {numberOwner ? <Hint tone={colors.loss}>Number {number} is taken by {numberOwner.name}. Pick another number.</Hint> : null}
        <Button label="Save profile" onPress={submit} busy={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photoRow: { flexDirection: "row", alignItems: "center", gap: space.lg, marginBottom: space.lg },
  photo: { width: 96, height: 96, borderRadius: radius.md },
  photoEmpty: { backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine, alignItems: "center", justifyContent: "center" },
  remove: { color: colors.loss, marginTop: space.xs },
});
