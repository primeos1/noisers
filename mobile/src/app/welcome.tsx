import { useRef, useState } from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedKeyboard,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { API_URL } from "../lib/config";
import { Stadium } from "../components/welcome/Stadium";
import { EnterButton, GOLD, ModeSwitch, PasscodeField, RedCard, Stamp, TicketField, Wordmark, haptic } from "../components/welcome/pieces";
import { Txt } from "../components/ui";
import { useSplashDone } from "../components/AnimatedSplash";
import { colors, fonts, space } from "../theme";

// The front door, like the web's /player-login, staged as a floodlit night
// match: players show their "matchday pass" (the squad passcode), committee
// flip the ticket over to the staff entrance. Stack.Protected in _layout
// moves on to the tabs once auth commits — after the admit animation.

const TICKET_HEIGHT = 356;

/** Ticket dips a little mid-flip, as if lifted off the table. */
function lift(v: number) {
  "worklet";
  return 1 - Math.sin(v * Math.PI) * 0.07;
}

/** Perforation + tear-off stub down the right edge of a ticket side. */
function Stub({ label, tear }: { label: string; tear: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - tear.value,
    transform: [{ translateX: tear.value * 70 }, { translateY: tear.value * 40 }, { rotate: `${tear.value * 28}deg` }],
  }));
  return (
    <>
      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchTop]} />
        <View style={styles.perfLine} />
        <View style={[styles.notch, styles.notchBottom]} />
      </View>
      <Animated.View style={[styles.stub, style]}>
        <View style={styles.stubTextWrap}>
          <Txt style={styles.stubText}>{label}</Txt>
        </View>
      </Animated.View>
    </>
  );
}

function Kicker({ children }: { children: string }) {
  return (
    <View style={styles.kickerRow}>
      <View style={styles.kickerDot} />
      <Txt style={styles.kicker}>{children}</Txt>
    </View>
  );
}

export default function WelcomeScreen() {
  // Hold the intro (floodlights, crest drop) until the loading screen has gone.
  const splashDone = useSplashDone();
  return splashDone ? <WelcomeScene /> : <View style={styles.root} />;
}

function WelcomeScene() {
  const { unlockSquad, signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const [mode, setMode] = useState<0 | 1>(0);
  const [passcode, setPasscode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [stampLabel, setStampLabel] = useState("ADMITTED");
  const [admitted, setAdmitted] = useState(false);

  const flip = useSharedValue(0);
  const shake = useSharedValue(0);
  const tear = useSharedValue(0);
  const stamp = useSharedValue(0);
  const flare = useSharedValue(0);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const passwordRef = useRef<TextInput>(null);
  const keyboard = useAnimatedKeyboard();

  function switchMode(next: 0 | 1) {
    Keyboard.dismiss();
    setMode(next);
    setError("");
    flip.value = reduced ? withTiming(next, { duration: 0 }) : withSpring(next, { damping: 13, stiffness: 80, mass: 1 });
  }

  function fail(message: string) {
    setError(message);
    setAttempt((a) => a + 1);
    setBusy(false);
    haptic.error();
    shake.value = withSequence(
      withTiming(-14, { duration: 45 }),
      withTiming(14, { duration: 70 }),
      withTiming(-10, { duration: 60 }),
      withTiming(8, { duration: 55 }),
      withTiming(-4, { duration: 45 }),
      withTiming(0, { duration: 40 }),
    );
  }

  /** Tear the stub, slam the stamp, flare the lights — then let auth commit. */
  function admit(label: string) {
    return new Promise<void>((resolve) => {
      Keyboard.dismiss();
      setStampLabel(label);
      setAdmitted(true);
      haptic.thud();
      tear.value = withTiming(1, { duration: 460, easing: Easing.in(Easing.back(1.8)) });
      stamp.value = withDelay(260, withSpring(1, { damping: 11, stiffness: 280 }));
      flare.value = withSequence(withDelay(260, withTiming(1, { duration: 160 })), withTiming(0.25, { duration: 700 }));
      setTimeout(haptic.success, 320);
      setTimeout(resolve, reduced ? 500 : 1250);
    });
  }

  async function enterAsPlayer() {
    if (!passcode.trim()) return fail("Enter the squad passcode first.");
    setBusy(true);
    setError("");
    try {
      await unlockSquad(passcode, () => admit("ADMITTED"));
    } catch (err) {
      fail(errorMessage(err, "Couldn't check that passcode."));
    }
  }

  async function enterAsStaff() {
    if (!email.trim() || !password) return fail("Enter your email and password.");
    setBusy(true);
    setError("");
    try {
      await signIn(email, password, () => admit("STAFF IN"));
    } catch (err) {
      fail(errorMessage(err, "Couldn't sign you in."));
    }
  }

  function scrollTicketIntoView() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 280);
  }

  function pulseLights() {
    flare.value = withSequence(withTiming(0.8, { duration: 120 }), withTiming(0, { duration: 500 }));
  }

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }, { scale: lift(flip.value) }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 - 180}deg` }, { scale: lift(flip.value) }],
  }));
  const keyboardSpacer = useAnimatedStyle(() => ({ height: keyboard.height.value }));

  const errorLine = error ? (
    <Animated.View key={attempt} entering={FadeIn.duration(250)} style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Txt style={styles.errorText}>{error}</Txt>
    </Animated.View>
  ) : (
    <View style={styles.errorRow} />
  );

  return (
    <View style={styles.root}>
      <Stadium flare={flare} />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + space.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Wordmark onCrestPress={pulseLights} />

        <View style={styles.flexSpacer} />

        <Animated.View entering={reduced ? undefined : FadeInDown.delay(1100).springify().damping(14)}>
          <ModeSwitch mode={mode} onChange={switchMode} />
        </Animated.View>

        {/* Entrance and shake are on separate views so neither overwrites the other's transform. */}
        <Animated.View entering={reduced ? undefined : FadeInDown.delay(1300).springify().damping(13)}>
          <Animated.View style={[styles.ticketArea, shakeStyle]}>
            {/* Front: the squad's matchday pass */}
            <Animated.View style={[styles.ticket, frontStyle]} pointerEvents={mode === 0 ? "auto" : "none"} accessibilityElementsHidden={mode !== 0} importantForAccessibility={mode === 0 ? "auto" : "no-hide-descendants"}>
              <View style={styles.ticketMain}>
                <View>
                  <Kicker>MATCHDAY PASS · SQUAD</Kicker>
                  <Txt style={styles.title}>Show your pass</Txt>
                  <Txt style={styles.sub}>Enter the passcode the committee shared with the squad.</Txt>
                </View>
                <View>
                  <PasscodeField
                    value={passcode}
                    onChangeText={(v) => {
                      setPasscode(v);
                      if (error) setError("");
                    }}
                    onSubmit={enterAsPlayer}
                    invalid={!!error && mode === 0}
                  />
                  {mode === 0 ? errorLine : <View style={styles.errorRow} />}
                </View>
                <EnterButton label={admitted ? "You're in" : "Enter the ground"} busy={busy && !admitted && mode === 0} onPress={enterAsPlayer} />
              </View>
              <Stub label="SQUAD · ADMIT ONE · Nº 2021" tear={tear} />
              <Stamp progress={stamp} label={stampLabel} />
            </Animated.View>
  
            {/* Back: the staff entrance */}
            <Animated.View style={[styles.ticket, styles.ticketBack, backStyle]} pointerEvents={mode === 1 ? "auto" : "none"} accessibilityElementsHidden={mode !== 1} importantForAccessibility={mode === 1 ? "auto" : "no-hide-descendants"}>
              <View style={styles.ticketMain}>
                <View>
                  <Kicker>STAFF ENTRANCE</Kicker>
                  <Txt style={styles.title}>Committee</Txt>
                </View>
                <View>
                  <TicketField
                    label="Email"
                    icon="mail-outline"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@noisersfc.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="username"
                    returnKeyType="next"
                    onFocus={scrollTicketIntoView}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  <TicketField
                    ref={passwordRef}
                    label="Password"
                    icon="lock-closed-outline"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onFocus={scrollTicketIntoView}
                    onSubmitEditing={enterAsStaff}
                  />
                  {mode === 1 ? errorLine : <View style={styles.errorRow} />}
                </View>
                <EnterButton label={admitted ? "You're in" : "Sign in"} busy={busy && !admitted && mode === 1} onPress={enterAsStaff} />
              </View>
              <Stub label="STAFF · ALL AREAS · Nº 2021" tear={tear} />
              <Stamp progress={stamp} label={stampLabel} />
            </Animated.View>

            <RedCard attempt={attempt} visible={!!error} />
          </Animated.View>
        </Animated.View>

        <Animated.View entering={reduced ? undefined : FadeIn.delay(1800)}>
          <Txt style={styles.server}>{API_URL.replace(/^https?:\/\//, "")}</Txt>
        </Animated.View>
        <Animated.View style={keyboardSpacer} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { flexGrow: 1, paddingHorizontal: space.lg },
  flexSpacer: { flexGrow: 1, minHeight: 28 },

  ticketArea: { height: TICKET_HEIGHT, marginTop: space.lg },
  ticket: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: "row",
    borderRadius: 20,
    backgroundColor: "#121a2d",
    borderWidth: 1,
    borderColor: "rgba(212,169,58,0.35)",
    backfaceVisibility: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  ticketBack: { backgroundColor: "#141b2f", borderColor: "rgba(246,246,243,0.22)" },
  ticketMain: { flex: 1, padding: space.lg + 2, paddingRight: space.md, justifyContent: "space-between" },

  kickerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  kicker: { fontFamily: fonts.bodySemi, fontSize: 10.5, letterSpacing: 2, color: GOLD },
  title: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 38, color: colors.paper, marginTop: 4 },
  sub: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.paperDim, marginTop: 2 },

  errorRow: { minHeight: 22, justifyContent: "center", marginTop: 6 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.loss },

  perforation: { width: 2, alignItems: "center" },
  perfLine: { flex: 1, width: 0, borderLeftWidth: 2, borderColor: "rgba(246,246,243,0.18)", borderStyle: "dashed", marginVertical: 14 },
  notch: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, left: -11 },
  notchTop: { top: -13 },
  notchBottom: { bottom: -13 },
  stub: { width: 58, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  stubTextWrap: { width: TICKET_HEIGHT - 40, alignItems: "center", transform: [{ rotate: "-90deg" }] },
  stubText: { fontFamily: fonts.display, fontSize: 15, letterSpacing: 3, color: "rgba(212,169,58,0.8)" },

  server: { marginTop: space.lg, textAlign: "center", fontSize: 11, color: colors.mist, letterSpacing: 0.5 },
});
