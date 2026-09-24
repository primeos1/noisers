// The animated loading screen. It picks up exactly where the native splash
// (crest centred on ink, see app.json) leaves off, so the hand-over is
// invisible: the crest rises, a gold ring draws round it, a glint of light
// crosses the badge and NOISERS lands letter by letter. A ball rolls while the
// app restores the session and loads club data; once ready, the ring bursts
// and the screen dissolves into the app.

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Line } from "react-native-svg";
import { colors, fonts } from "../theme";

const crest = require("../../assets/brand/crest.png");

/** Must match the splash plugin's imageWidth in app.json for a seamless hand-over. */
export const SPLASH_CREST_SIZE = 200;

const GOLD = "#d4a93a";
const RING_R = 118;
const RING_LEN = 2 * Math.PI * RING_R;
const MIN_SHOW_MS = 2600;
const MAX_WAIT_MS = 7000;
const TRACK = 150;
const BALL = 20;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/* Whether the loading screen has finished — screens with their own intro
   (the welcome screen) wait for this so it isn't played behind the overlay. */
const SplashDoneContext = createContext(true);
export const useSplashDone = () => use(SplashDoneContext);
export function SplashDoneProvider({ done, children }: { done: boolean; children: ReactNode }) {
  return <SplashDoneContext value={done}>{children}</SplashDoneContext>;
}

function Letter({ char, index, exit }: { char: string; index: number; exit: SharedValue<number> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(750 + index * 75, withSpring(1, { damping: 12, stiffness: 150 }));
  }, [t, index]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(t.value * 1.6, 1) * (1 - exit.value),
    color: interpolateColor(t.value, [0, 0.7, 1], [GOLD, GOLD, colors.paper]),
    transform: [
      { translateY: (1 - t.value) * 28 - exit.value * 18 },
      { scale: interpolate(t.value, [0, 1], [0.5, 1]) },
    ],
  }));
  return <Animated.Text style={[styles.letter, style]}>{char}</Animated.Text>;
}

function RollingBall({ exit }: { exit: SharedValue<number> }) {
  const x = useSharedValue(0);
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(1500, withTiming(1, { duration: 500 }));
    x.value = withDelay(1500, withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [x, appear]);
  const travel = TRACK - BALL;
  const wrap = useAnimatedStyle(() => ({ opacity: appear.value * (1 - exit.value) }));
  const ball = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value * travel },
      // Rolls without slipping: one turn per circumference travelled.
      { rotate: `${((x.value * travel) / (Math.PI * BALL)) * 360}deg` },
    ],
  }));
  const trail = useAnimatedStyle(() => ({ transform: [{ scaleX: x.value }] }));
  return (
    <Animated.View style={[styles.loader, wrap]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={styles.track}>
        <Animated.View style={[styles.trackFill, { transformOrigin: "0% 50%" }, trail]} />
      </View>
      <Animated.View style={[styles.ball, ball]}>
        <Ionicons name="football" size={BALL} color={colors.paper} />
      </Animated.View>
    </Animated.View>
  );
}

export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const intro = useSharedValue(0); // crest settles into place
  const ring = useSharedValue(0); // gold ring draws
  const ticks = useSharedValue(0); // outer tick ring turns
  const shine = useSharedValue(0); // glint across the badge
  const breathe = useSharedValue(0); // glow pulse
  const pitch = useSharedValue(0); // centre-circle markings
  const exit = useSharedValue(0);

  const [minElapsed, setMinElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), reduced ? 700 : MIN_SHOW_MS);
    const max = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    if (reduced) {
      intro.value = 1;
      ring.value = 1;
      pitch.value = 1;
    } else {
      intro.value = withDelay(250, withSpring(1, { damping: 14, stiffness: 70 }));
      ring.value = withDelay(350, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
      pitch.value = withDelay(200, withTiming(1, { duration: 1600, easing: Easing.out(Easing.cubic) }));
      ticks.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1);
      breathe.value = withDelay(900, withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
      shine.value = withDelay(1100, withRepeat(withSequence(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }), withDelay(1600, withTiming(0, { duration: 0 }))), -1));
    }
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, [reduced, intro, ring, pitch, ticks, breathe, shine]);

  useEffect(() => {
    if (leaving.current || !minElapsed || !(ready || timedOut)) return;
    leaving.current = true;
    const duration = reduced ? 250 : 750;
    exit.value = withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) });
    const done = setTimeout(onDone, duration);
    return () => clearTimeout(done);
  }, [minElapsed, ready, timedOut, reduced, exit, onDone]);

  // Crest rises from the native splash position to sit above the wordmark.
  const lift = -Math.min(height * 0.09, 78);

  const rootStyle = useAnimatedStyle(() => ({ opacity: interpolate(exit.value, [0, 0.45, 1], [1, 1, 0]) }));
  const crestGroup = useAnimatedStyle(() => ({
    transform: [
      { translateY: intro.value * lift },
      { scale: interpolate(intro.value, [0, 1], [1, 0.82]) * interpolate(exit.value, [0, 1], [1, 1.25]) },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: (0.3 + breathe.value * 0.35) * Math.min(intro.value * 1.5, 1) * (1 - exit.value),
    transform: [{ scale: 1 + breathe.value * 0.12 + exit.value * 0.6 }],
  }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LEN * (1 - ring.value) }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 1.4 }],
  }));
  const ticksStyle = useAnimatedStyle(() => ({
    opacity: Math.min(ring.value * 1.2, 1) * 0.55 * (1 - exit.value),
    transform: [{ rotate: `${ticks.value * 360}deg` }, { scale: 1 + exit.value * 0.9 }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shine.value, [0, 1], [-SPLASH_CREST_SIZE, SPLASH_CREST_SIZE * 1.1]) }, { rotate: "22deg" }],
  }));
  const pitchCircle = useAnimatedProps(() => ({ strokeDashoffset: 2 * Math.PI * 170 * (1 - pitch.value) }));
  const pitchLine = useAnimatedProps(() => ({ strokeDashoffset: width * (1 - pitch.value) }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(intro.value, [0.6, 1], [0, 1], "clamp") * (1 - exit.value),
  }));

  const box = RING_R * 2 + 40;
  const cx = width / 2;
  const cy = height / 2;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      <LinearGradient colors={["#05070f", colors.ink, "#0b1322"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {/* Faint centre-circle and halfway line, drawn in behind the crest */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <AnimatedCircle cx={cx} cy={cy + lift * 0.82} r={170} stroke={colors.paper} strokeOpacity={0.06} strokeWidth={1.5} fill="none" strokeDasharray={[2 * Math.PI * 170, 2 * Math.PI * 170]} animatedProps={pitchCircle} />
        <AnimatedLine x1={0} y1={cy + lift * 0.82} x2={width} y2={cy + lift * 0.82} stroke={colors.paper} strokeOpacity={0.05} strokeWidth={1.5} strokeDasharray={[width, width]} animatedProps={pitchLine} />
      </Svg>

      <View style={styles.center}>
        <Animated.View style={[styles.crestGroup, { width: box, height: box }, crestGroup]}>
          <Animated.View style={[styles.glow, glowStyle]}>
            <View style={styles.glowInner} />
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, ticksStyle]}>
            <Svg width={box} height={box}>
              <Circle cx={box / 2} cy={box / 2} r={RING_R + 12} stroke={GOLD} strokeWidth={3} strokeDasharray={[1.5, 9]} strokeLinecap="round" fill="none" />
            </Svg>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
            <Svg width={box} height={box} style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={box / 2} cy={box / 2} r={RING_R} stroke={colors.inkLine} strokeWidth={2} fill="none" />
              <AnimatedCircle
                cx={box / 2}
                cy={box / 2}
                r={RING_R}
                stroke={GOLD}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={[RING_LEN, RING_LEN]}
                animatedProps={ringProps}
              />
            </Svg>
          </Animated.View>

          <View style={styles.crestClip}>
            <Image source={crest} style={styles.crest} contentFit="contain" accessibilityLabel="Noisers FC" />
            <Animated.View style={[styles.shine, shineStyle]}>
              <LinearGradient
                colors={["rgba(212,169,58,0)", "rgba(255,236,180,0.55)", "rgba(212,169,58,0)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        </Animated.View>

        <View style={[styles.below, { top: cy + lift + (SPLASH_CREST_SIZE * 0.82) / 2 + 34 }]}>
          <View style={styles.letters}>
            {"NOISERS".split("").map((c, i) => (
              <Letter key={i} char={c} index={i} exit={exit} />
            ))}
          </View>
          <Animated.View style={[styles.taglineRow, taglineStyle]}>
            <View style={styles.rule} />
            <Animated.Text style={styles.tagline}>FC · VALE 2 ZENITH</Animated.Text>
            <View style={styles.rule} />
          </Animated.View>
          <RollingBall exit={exit} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, backgroundColor: colors.ink },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  crestGroup: { alignItems: "center", justifyContent: "center" },
  // Two soft halos rather than one flat disc: a wide faint wash and a warmer core.
  glow: { position: "absolute", width: RING_R * 2.9, height: RING_R * 2.9, borderRadius: RING_R * 1.45, backgroundColor: "rgba(212,169,58,0.06)", alignItems: "center", justifyContent: "center" },
  glowInner: { width: RING_R * 2.15, height: RING_R * 2.15, borderRadius: RING_R * 1.075, backgroundColor: "rgba(232,190,90,0.10)" },
  crestClip: { width: SPLASH_CREST_SIZE, height: SPLASH_CREST_SIZE, borderRadius: SPLASH_CREST_SIZE / 2, overflow: "hidden" },
  crest: { width: SPLASH_CREST_SIZE, height: SPLASH_CREST_SIZE },
  shine: { position: "absolute", top: -40, bottom: -40, width: 70 },
  below: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  letters: { flexDirection: "row" },
  letter: { fontFamily: fonts.displayHeavy, fontSize: 54, lineHeight: 58, letterSpacing: 3 },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  rule: { width: 24, height: 1, backgroundColor: GOLD, opacity: 0.7 },
  tagline: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 3, color: GOLD },
  loader: { width: TRACK, height: BALL, marginTop: 34, justifyContent: "center" },
  track: { position: "absolute", left: BALL / 2, right: BALL / 2, height: 2, borderRadius: 1, backgroundColor: colors.inkLine, overflow: "hidden" },
  trackFill: { height: 2, backgroundColor: GOLD },
  ball: { position: "absolute", left: 0, width: BALL, height: BALL },
});
