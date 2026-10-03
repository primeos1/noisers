import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth";
import { useClub } from "../lib/club";
import { apiFetch, errorMessage } from "../lib/api";
import { positionLabel, positions } from "../lib/derive";
import { appendImage, pickImage, type PickedImage } from "../lib/media";
import type { Membership, Player, Position } from "../lib/types";
import { Choice, FormError, Hint, Label, Section, TextField } from "../components/form";
import { Button, Screen, Txt, text } from "../components/ui";
import { CardFace } from "../components/PlayerCard";
import { Reveal, haptic } from "../components/depth";
import { colors, fonts, glass, radius, space } from "../theme";

// The /join sign-up (frontend/src/pages/JoinSquad.tsx): a new player enters
// the squad passcode, picks a free shirt number and position, and is added
// to the squad at the new-player rating. A live preview of their card
// builds as they type. Joining from the front door also lets them in.

const NUMBERS = Array.from({ length: 99 }, (_, i) => i + 1);

export default function JoinScreen() {
  const { hasAccess, squadPasscode, unlockSquad } = useAuth();
  const { players, settings, refresh, setMyShirt } = useClub();

  const [passcode, setPasscode] = useState(squadPasscode ?? "");
  const [name, setName] = useState("");
  const [membership, setMembership] = useState<Membership>("member");
  const [number, setNumber] = useState<number | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [second, setSecond] = useState<Position | "">("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<Player | null>(null);

  const taken = useMemo(() => new Set(players.map((p) => p.number)), [players]);

  // What their card will look like.
  const preview: Player = {
    id: 0,
    number: number ?? 0,
    name: name.trim() || "Your name",
    position: position ?? "MID",
    secondaryPosition: null,
    membership,
    bio: null,
    photoUrl: photo?.uri ?? null,
    active: true,
    rating: settings.ratingNewPlayer,
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
  };

  async function choosePhoto() {
    try {
      const picked = await pickImage(800);
      if (picked) setPhoto(picked);
    } catch (err) {
      setError(errorMessage(err, "Couldn't open that photo."));
    }
  }

  async function submit() {
    if (!passcode.trim()) return setError("Enter the squad passcode the committee shared.");
    if (!name.trim()) return setError("Enter your name.");
    if (!number) return setError("Pick a shirt number.");
    if (!position) return setError("Pick your main position.");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("passcode", passcode.trim());
      form.append("name", name.trim());
      form.append("membership", membership);
      form.append("number", String(number));
      form.append("position", position);
      if (second && second !== position) form.append("secondary_position", second);
      if (phone.trim()) form.append("phone", phone.trim());
      if (email.trim()) form.append("email", email.trim());
      if (photo) await appendImage(form, "photo", photo);
      const res = await apiFetch<{ data: Player }>("/players/join", { method: "POST", form, timeoutMs: 60000 });
      haptic.success();
      await refresh();
      setJoined(res.data);
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign you up. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function enter() {
    if (!joined) return;
    setMyShirt(joined.id);
    if (!hasAccess) {
      setBusy(true);
      try {
        await unlockSquad(passcode);
      } catch (err) {
        setBusy(false);
        return setError(errorMessage(err, "Signed up, but couldn't open the app. Use the passcode on the front door."));
      }
    }
    // From the front door, closing this lands on the home tab now the app is
    // open; from inside, go straight to the new player.
    if (hasAccess) router.replace(`/player/${joined.id}`);
    else if (router.canGoBack()) router.back();
  }

  if (joined) {
    return (
      <Screen>
        <Reveal style={styles.done}>
          <CardFace player={joined} width={220} />
          <Txt style={styles.doneTitle}>Welcome to Noisers, {joined.name.split(" ")[0]}</Txt>
          <Txt style={[text.dim, styles.center]}>
            {`You're number ${joined.number}. Your rating starts at ${joined.rating.toFixed(1)} and moves with every match day.`}
          </Txt>
          <FormError message={error} />
          <View style={styles.doneAction}>
            <Button label={hasAccess ? "Open their profile" : "Enter the app"} icon="arrow-forward" variant="gold" busy={busy} onPress={enter} />
          </View>
        </Reveal>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={styles.previewWrap}>
          <LinearGradient colors={["rgba(212,169,58,0.25)", "transparent"]} style={styles.previewGlow} />
          <CardFace player={preview} width={170} />
          <Txt style={[text.small, styles.previewHint]}>Your card builds as you fill this in</Txt>
        </View>

        <Section title="The squad passcode" description="Ask the committee — it's the same one that opens the app.">
          <TextField value={passcode} onChangeText={setPasscode} placeholder="Passcode" autoCapitalize="none" autoCorrect={false} secureTextEntry={!squadPasscode} />
        </Section>

        <Section title="About you">
          <TextField label="Full name" value={name} onChangeText={setName} placeholder="As the squad knows you" autoCapitalize="words" textContentType="name" />
          <Label>Membership</Label>
          <Choice<Membership>
            value={membership}
            onChange={setMembership}
            options={[
              { value: "member", label: "Member", hint: "A full club member" },
              { value: "guest", label: "Guest member", hint: "Plays with the squad" },
            ]}
          />
          <Label>Photo</Label>
          <Pressable onPress={choosePhoto} style={styles.photoRow} accessibilityRole="button" accessibilityLabel="Choose a profile photo">
            {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" /> : <View style={[styles.photo, styles.photoEmpty]}><Ionicons name="camera" size={22} color={colors.mist} /></View>}
            <Txt style={text.semi}>{photo ? "Change photo" : "Add a photo (optional)"}</Txt>
          </Pressable>
        </Section>

        <Section title="Shirt number" description={number ? `Number ${number} is yours.` : "Greyed-out numbers are taken."}>
          <View style={styles.numbers}>
            {NUMBERS.map((n) => {
              const isTaken = taken.has(n);
              const active = number === n;
              return (
                <Pressable
                  key={n}
                  disabled={isTaken}
                  onPress={() => {
                    haptic.tap();
                    setNumber(n);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled: isTaken }}
                  accessibilityLabel={isTaken ? `${n}, taken` : String(n)}
                  style={[styles.num, active ? styles.numActive : null, isTaken ? styles.numTaken : null]}
                >
                  <Txt style={[styles.numText, active ? styles.numTextActive : null]}>{n}</Txt>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Position">
          <Label>Main position</Label>
          <Choice<Position | "none"> value={position ?? "none"} onChange={(v) => setPosition(v === "none" ? null : v)} options={positions.map((p) => ({ value: p, label: positionLabel[p] }))} />
          <Label>Second position (optional)</Label>
          <Choice<Position | ""> value={second} onChange={setSecond} options={[{ value: "", label: "None" }, ...positions.filter((p) => p !== position).map((p) => ({ value: p, label: positionLabel[p] }))]} />
        </Section>

        <Section title="Contact" description="Only the committee sees these.">
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="+234…" />
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" placeholder="you@example.com" />
          <Hint>Optional, so the club can reach you about fixtures.</Hint>
        </Section>

        <FormError message={error} />
        <Button label="Join the squad" icon="checkmark" variant="gold" busy={busy} onPress={submit} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  previewWrap: { alignItems: "center", marginBottom: space.xl, paddingTop: space.md },
  previewGlow: { position: "absolute", top: 0, left: -16, right: -16, height: 260, borderRadius: radius.xl },
  previewHint: { marginTop: space.md },
  photoRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64 },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: glass.raised },
  photoEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderColor: glass.edgeBright },
  numbers: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  num: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: glass.raised, borderWidth: 1, borderColor: glass.edge },
  numActive: { backgroundColor: colors.goldBright, borderColor: colors.goldBright },
  numTaken: { opacity: 0.22 },
  numText: { fontFamily: fonts.display, fontSize: 17, color: colors.paper },
  numTextActive: { color: colors.ink },
  done: { alignItems: "center", paddingTop: space.xxl, gap: space.md },
  doneTitle: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 36, color: colors.paper, textAlign: "center", marginTop: space.lg },
  doneAction: { alignSelf: "stretch", marginTop: space.lg },
});
