// Interactive parts of the welcome ticket. Motion is transform/opacity only,
// and loops are skipped when the phone asks for reduced motion.

import { forwardRef, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Txt } from "../ui";
import { colors, fonts, radius, space } from "../../theme";

const logo = require("../../../assets/brand/crest.png");

export const GOLD = "#d4a93a";

/** Haptics are phone-only; every call is fire-and-forget. */
export const haptic = {
  select: () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => undefined);
  },
  tap: () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  thud: () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  },
  success: () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  error: () => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
};

/* ------------------------------------------------------------------ */
/* Crest + wordmark                                                    */
/* ------------------------------------------------------------------ */

function RisingLetter({ char, index }: { char: string; index: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(650 + index * 70, withSpring(1, { damping: 11, stiffness: 140 }));
  }, [t, index]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(t.value * 1.5, 1),
    transform: [{ translateY: (1 - t.value) * 36 }, { rotate: `${(1 - t.value) * (index % 2 ? 8 : -8)}deg` }],
  }));
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

export function Wordmark({ onCrestPress }: { onCrestPress: () => void }) {
  const reduced = useReducedMotion();
  const drop = useSharedValue(reduced ? 1 : 0);
  const spin = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    drop.value = withDelay(350, withSpring(1, { damping: 9, stiffness: 90, mass: 0.9 }));
    halo.value = withDelay(1200, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [drop, halo, reduced]);

  const crestStyle = useAnimatedStyle(() => ({
    opacity: Math.min(drop.value * 2, 1),
    transform: [
      { translateY: (1 - drop.value) * -160 },
      { rotate: `${(1 - drop.value) * -35 + spin.value * 360}deg` },
      { scale: interpolate(drop.value, [0, 1], [0.6, 1]) },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + halo.value * 0.35,
    transform: [{ scale: 1 + halo.value * 0.18 }],
  }));

  function kickCrest() {
    // A little easter egg: tap the crest and it spins like a ball.
    haptic.tap();
    spin.value = withSequence(withTiming(spin.value + 1, { duration: 700, easing: Easing.out(Easing.back(1.4)) }));
    onCrestPress();
  }

  return (
    <View style={styles.wordmark}>
      <Pressable onPress={kickCrest} accessibilityRole="imagebutton" accessibilityLabel="Noisers FC crest">
        <Animated.View style={[styles.halo, haloStyle]} />
        <Animated.View style={crestStyle}>
          <Image source={logo} style={styles.crest} contentFit="contain" />
        </Animated.View>
      </Pressable>
      <View style={styles.letters} accessible accessibilityRole="header" accessibilityLabel="Noisers FC">
        {"NOISERS".split("").map((c, i) => (reduced ? <Txt key={i} style={styles.letter}>{c}</Txt> : <RisingLetter key={i} char={c} index={i} />))}
      </View>
      <Animated.View entering={reduced ? undefined : FadeIn.delay(1300).duration(600)} style={styles.mottoRow}>
        <View style={styles.mottoRule} />
        <Txt style={styles.motto}>FC · VALE 2 ZENITH · EST. 2021</Txt>
        <View style={styles.mottoRule} />
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Player / Committee switch                                           */
/* ------------------------------------------------------------------ */

export function ModeSwitch({ mode, onChange }: { mode: 0 | 1; onChange: (m: 0 | 1) => void }) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(mode);
  useEffect(() => {
    x.value = withSpring(mode, { damping: 15, stiffness: 180 });
  }, [mode, x]);
  // Clamped so the spring's bounce never pushes the thumb past the pill.
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: Math.min(Math.max(x.value, 0), 1) * ((width - 8) / 2) }] }));

  const options = [
    { label: "Player", icon: "shirt-outline" as const },
    { label: "Committee", icon: "shield-half-outline" as const },
  ];

  return (
    <View style={styles.switch} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {width > 0 ? <Animated.View style={[styles.switchThumb, { width: (width - 8) / 2 }, thumb]} /> : null}
      {options.map((o, i) => {
        const active = mode === i;
        return (
          <Pressable
            key={o.label}
            style={styles.switchOption}
            onPress={() => {
              if (!active) {
                haptic.select();
                onChange(i as 0 | 1);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={o.icon} size={16} color={active ? colors.ink : colors.paperDim} />
            <Txt style={[styles.switchText, active ? styles.switchTextActive : null]}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Passcode: every character is a football                             */
/* ------------------------------------------------------------------ */

function Caret() {
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(withSequence(withTiming(0, { duration: 450 }), withTiming(1, { duration: 450 })), -1);
  }, [blink]);
  const style = useAnimatedStyle(() => ({ opacity: blink.value }));
  return <Animated.View style={[styles.caret, style]} />;
}

export const PasscodeField = forwardRef<TextInput, { value: string; onChangeText: (v: string) => void; onSubmit: () => void; invalid: boolean }>(
  function PasscodeField({ value, onChangeText, onSubmit, invalid }, ref) {
    const [focused, setFocused] = useState(false);
    const [reveal, setReveal] = useState(false);
    const glow = useSharedValue(0);
    useEffect(() => {
      glow.value = withTiming(focused ? 1 : 0, { duration: 220 });
    }, [focused, glow]);
    const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

    const chars = value.split("");

    return (
      <View>
        <View style={[styles.pips, invalid ? styles.pipsInvalid : null]}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pipsGlow, glowStyle]} />
          <View style={styles.pipRow} pointerEvents="none">
            {chars.length === 0 && !focused ? (
              <Txt style={styles.pipPlaceholder}>Tap to enter the passcode</Txt>
            ) : (
              chars.map((c, i) => (
                <Animated.View key={i} entering={ZoomIn.springify().damping(9)} exiting={ZoomOut.duration(140)} style={styles.pip}>
                  {reveal ? <Txt style={styles.pipChar}>{c}</Txt> : <Ionicons name="football" size={20} color={colors.paper} />}
                </Animated.View>
              ))
            )}
            {focused ? <Caret /> : null}
          </View>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={(v) => {
              if (v.length > value.length) haptic.select();
              onChangeText(v);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={onSubmit}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={64}
            returnKeyType="go"
            caretHidden
            style={styles.hiddenInput}
            accessibilityLabel="Squad passcode"
          />
          <Pressable
            onPress={() => setReveal((r) => !r)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={reveal ? "Hide passcode" : "Show passcode"}
          >
            <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={20} color={colors.mist} />
          </Pressable>
        </View>
      </View>
    );
  },
);

/* ------------------------------------------------------------------ */
/* Committee fields with a sweeping focus underline                    */
/* ------------------------------------------------------------------ */

export const TicketField = forwardRef<TextInput, TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap }>(
  function TicketField({ label, icon, onFocus, onBlur, ...props }, ref) {
    const line = useSharedValue(0);
    const lineStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: line.value }] }));
    const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + line.value * 0.15 }] }));
    return (
      <View style={styles.field}>
        <Txt style={styles.fieldLabel}>{label}</Txt>
        <View style={styles.fieldRow}>
          <Animated.View style={iconStyle}>
            <Ionicons name={icon} size={18} color={colors.paperDim} />
          </Animated.View>
          <TextInput
            ref={ref}
            {...props}
            placeholderTextColor={colors.mist}
            style={styles.fieldInput}
            accessibilityLabel={label}
            onFocus={(e) => {
              line.value = withSpring(1, { damping: 18, stiffness: 160 });
              onFocus?.(e);
            }}
            onBlur={(e) => {
              line.value = withTiming(0, { duration: 200 });
              onBlur?.(e);
            }}
          />
        </View>
        <View style={styles.fieldTrack}>
          <Animated.View style={[styles.fieldLine, { transformOrigin: "0% 50%" }, lineStyle]} />
        </View>
      </View>
    );
  },
);

/* ------------------------------------------------------------------ */
/* Enter button: press squash, shimmer sweep, spinning ball when busy  */
/* ------------------------------------------------------------------ */

export function EnterButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const press = useSharedValue(1);
  const sweep = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.value = withDelay(1800, withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withDelay(2200, withTiming(0, { duration: 0 }))), -1));
  }, [sweep, reduced]);

  useEffect(() => {
    spin.value = busy ? withRepeat(withTiming(spin.value + 1, { duration: 700, easing: Easing.linear }), -1) : 0;
  }, [busy, spin]);

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -120 + sweep.value * 520 }, { skewX: "-20deg" }] }));
  const ballStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onPressIn={() => (press.value = withSpring(0.95, { damping: 15, stiffness: 400 }))}
      onPressOut={() => (press.value = withSpring(1, { damping: 10, stiffness: 300 }))}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
    >
      <Animated.View style={[styles.enter, buttonStyle]}>
        <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
          <LinearGradient colors={["transparent", "rgba(212,169,58,0.55)", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {busy ? (
          <Animated.View style={ballStyle}>
            <Ionicons name="football" size={22} color={colors.ink} />
          </Animated.View>
        ) : null}
        <Txt style={styles.enterText}>{busy ? "Checking…" : label}</Txt>
        {busy ? null : <Ionicons name="arrow-forward" size={18} color={colors.ink} />}
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Referee's red card for a wrong passcode                             */
/* ------------------------------------------------------------------ */

export function RedCard({ attempt, visible }: { attempt: number; visible: boolean }) {
  const t = useSharedValue(0);
  const shown = useRef(false);
  useEffect(() => {
    if (visible && attempt > 0) {
      // Each wrong try: the referee pulls the card out again.
      t.value = 0;
      t.value = withSpring(1, { damping: 8, stiffness: 120 });
      shown.current = true;
    } else if (shown.current) {
      t.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
    }
  }, [attempt, visible, t]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(t.value * 3, 1),
    transform: [{ translateY: (1 - t.value) * -90 }, { rotate: `${interpolate(t.value, [0, 1], [-50, 14])}deg` }, { scale: interpolate(t.value, [0, 1], [1.4, 1]) }],
  }));
  if (attempt === 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.redCard, style]}>
      <View style={styles.redCardShine} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* "ADMITTED" stamp that slams onto the ticket                        */
/* ------------------------------------------------------------------ */

export function Stamp({ progress, label }: { progress: SharedValue<number>; label: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: progress.value > 0 ? Math.min(progress.value * 2, 1) : 0,
    transform: [{ scale: interpolate(progress.value, [0, 1], [2.6, 1]) }, { rotate: "-14deg" }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.stampWrap, style]}>
      <View style={styles.stamp}>
        <Ionicons name="checkmark-circle" size={22} color={GOLD} />
        <Txt style={styles.stampText}>{label}</Txt>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wordmark: { alignItems: "center" },
  halo: { position: "absolute", top: 6, left: 6, right: 6, bottom: 6, borderRadius: 60, backgroundColor: "rgba(212,169,58,0.35)" },
  crest: { width: 104, height: 104 },
  letters: { flexDirection: "row", marginTop: space.md },
  letter: { fontFamily: fonts.displayHeavy, fontSize: 58, lineHeight: 62, color: colors.paper, letterSpacing: 2 },
  mottoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  mottoRule: { width: 22, height: 1, backgroundColor: GOLD, opacity: 0.7 },
  motto: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 2, color: GOLD },

  switch: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: "rgba(19,26,43,0.85)", borderWidth: 1, borderColor: colors.inkLine },
  switchThumb: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: colors.paper },
  switchOption: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  switchText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim },
  switchTextActive: { color: colors.ink },

  pips: { minHeight: 60, borderRadius: 14, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.inkLine, justifyContent: "center", paddingLeft: space.lg, paddingRight: 48 },
  pipsInvalid: { borderColor: colors.loss },
  pipsGlow: { borderRadius: 14, borderWidth: 1.5, borderColor: GOLD },
  pipRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingVertical: space.sm },
  pip: { width: 22, height: 26, alignItems: "center", justifyContent: "center" },
  pipChar: { fontFamily: fonts.display, fontSize: 22, color: colors.paper },
  pipPlaceholder: { fontFamily: fonts.body, fontSize: 15, color: colors.mist },
  caret: { width: 2, height: 22, borderRadius: 1, backgroundColor: GOLD },
  hiddenInput: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: "transparent" },
  eye: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },

  field: { marginBottom: space.lg },
  fieldLabel: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1.5, color: colors.mist, textTransform: "uppercase" },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldInput: { flex: 1, minHeight: 44, color: colors.paper, fontFamily: fonts.body, fontSize: 16 },
  fieldTrack: { height: 2, backgroundColor: colors.inkLine, borderRadius: 1, overflow: "hidden" },
  fieldLine: { height: 2, backgroundColor: GOLD },

  enter: { minHeight: 54, borderRadius: radius.pill, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" },
  sweep: { position: "absolute", top: -10, bottom: -10, width: 90 },
  enterText: { fontFamily: fonts.displayHeavy, fontSize: 21, letterSpacing: 1, color: colors.ink },

  redCard: { position: "absolute", top: -34, right: 26, width: 42, height: 58, borderRadius: 5, backgroundColor: colors.loss, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  redCardShine: { position: "absolute", top: 4, left: 4, width: 10, height: 50, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)" },

  stampWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  stamp: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 3, borderColor: GOLD, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(10,14,26,0.85)" },
  stampText: { fontFamily: fonts.displayHeavy, fontSize: 30, letterSpacing: 3, color: GOLD },
});
