// The night-match backdrop behind the welcome screen: two floodlights that
// flicker on and sway, dust drifting through the beams, and a pitch whose
// markings draw themselves in perspective.

import { memo, useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Polygon, Stop } from "react-native-svg";
import { colors } from "../../theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const LIGHT = "255,244,214"; // warm floodlight white

// Pitch markings in a 300×200 box, with each path's length for the draw-in.
const PITCH_LINES = [
  { d: "M10 10 H290 V190 H10 Z", len: 920 },
  { d: "M150 10 V190", len: 180 },
  { d: "M150 70 A30 30 0 1 1 149.99 70", len: 189 },
  { d: "M10 60 H55 V140 H10", len: 170 },
  { d: "M290 60 H245 V140 H290", len: 170 },
  { d: "M10 82 H26 V118 H10", len: 68 },
  { d: "M290 82 H274 V118 H290", len: 68 },
];

function PitchLine({ d, len, progress }: { d: string; len: number; progress: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - progress.value) }));
  return (
    <AnimatedPath
      d={d}
      stroke={colors.paper}
      strokeOpacity={0.16}
      strokeWidth={1.4}
      fill="none"
      strokeDasharray={[len, len]}
      animatedProps={animatedProps}
    />
  );
}

function Beam({
  side,
  width,
  height,
  lights,
  flare,
  still,
}: {
  side: "left" | "right";
  width: number;
  height: number;
  lights: SharedValue<number>;
  flare: SharedValue<number>;
  still: boolean;
}) {
  const sway = useSharedValue(0);
  const base = side === "left" ? -24 : 24;

  useEffect(() => {
    if (still) return;
    sway.value = withDelay(
      side === "left" ? 0 : 1400,
      withRepeat(withSequence(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: 3800, easing: Easing.inOut(Easing.sin) })), -1, true),
    );
  }, [sway, side, still]);

  const style = useAnimatedStyle(() => ({
    opacity: lights.value * (0.75 + flare.value * 0.5),
    transform: [{ rotate: `${base + sway.value * 5}deg` }],
  }));

  const id = `beam-${side}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.beam,
        { width, height, transformOrigin: "50% 0%" },
        side === "left" ? { left: -width / 2 + 34 } : { right: -width / 2 + 34 },
        style,
      ]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgb(${LIGHT})`} stopOpacity={0.34} />
            <Stop offset="0.55" stopColor={`rgb(${LIGHT})`} stopOpacity={0.08} />
            <Stop offset="1" stopColor={`rgb(${LIGHT})`} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        <Polygon points={`${width / 2 - 8},0 ${width / 2 + 8},0 ${width},${height} 0,${height}`} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** A floodlight head: a little grid of lamps with a glow. */
function Lamp({ side, lights, flare }: { side: "left" | "right"; lights: SharedValue<number>; flare: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + lights.value * 0.75, transform: [{ scale: 1 + flare.value * 0.15 }] }));
  return (
    <Animated.View style={[styles.lamp, side === "left" ? { left: 18 } : { right: 18 }, style]} pointerEvents="none">
      <View style={styles.lampGrid}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={styles.lampBulb} />
        ))}
      </View>
    </Animated.View>
  );
}

function Mote({ x, y, size, delay, duration, lights }: { x: number; y: number; size: number; delay: number; duration: number; lights: SharedValue<number> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, [t, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: lights.value * (t.value < 0.2 ? t.value * 5 : t.value > 0.8 ? (1 - t.value) * 5 : 1) * 0.7,
    transform: [{ translateY: -t.value * 140 }, { translateX: Math.sin(t.value * Math.PI * 2) * 10 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.mote, { left: x, top: y, width: size, height: size, borderRadius: size / 2 }, style]} />;
}

export const Stadium = memo(function Stadium({ flare }: { flare: SharedValue<number> }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const lights = useSharedValue(reduced ? 1 : 0);
  const draw = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    // Floodlights stutter on, like a real stadium warming up.
    lights.value = withDelay(
      250,
      withSequence(
        withTiming(0.9, { duration: 60 }),
        withTiming(0.1, { duration: 90 }),
        withTiming(0.7, { duration: 50 }),
        withTiming(0.2, { duration: 120 }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
      ),
    );
    draw.value = withDelay(500, withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }));
  }, [lights, draw, reduced]);

  const motes = useMemo(() => {
    // Deterministic scatter so re-renders don't reshuffle the dust.
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 16 }, (_, i) => {
      const left = i % 2 === 0;
      return {
        key: i,
        x: left ? 20 + rand() * width * 0.4 : width * 0.55 + rand() * width * 0.4,
        y: 120 + rand() * height * 0.45,
        size: 2 + rand() * 3,
        delay: rand() * 5000,
        duration: 6000 + rand() * 5000,
      };
    });
  }, [width, height]);

  const flareStyle = useAnimatedStyle(() => ({ opacity: flare.value * 0.22 }));
  const beamWidth = width * 0.95;
  const beamHeight = height * 0.95;
  const pitchWidth = width * 1.5;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={["#05070f", colors.ink, "#0c1426"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />

      {/* The pitch, tilted away from the viewer */}
      <View style={[styles.pitchWrap, { width: pitchWidth, height: pitchWidth * 0.66, left: (width - pitchWidth) / 2, top: height * 0.5 }]}>
        <Svg width="100%" height="100%" viewBox="0 0 300 200">
          {PITCH_LINES.map((l) => (
            <PitchLine key={l.d} d={l.d} len={l.len} progress={draw} />
          ))}
        </Svg>
      </View>
      <LinearGradient colors={["transparent", "rgba(47,158,138,0.08)", "rgba(5,7,15,0.9)"]} locations={[0, 0.6, 1]} style={[styles.pitchFade, { top: height * 0.45 }]} />

      <Beam side="left" width={beamWidth} height={beamHeight} lights={lights} flare={flare} still={reduced} />
      <Beam side="right" width={beamWidth} height={beamHeight} lights={lights} flare={flare} still={reduced} />
      <Lamp side="left" lights={lights} flare={flare} />
      <Lamp side="right" lights={lights} flare={flare} />

      {reduced ? null : motes.map(({ key, ...m }) => <Mote key={key} {...m} lights={lights} />)}

      <Animated.View style={[StyleSheet.absoluteFill, styles.flare, flareStyle]} />
    </View>
  );
});

const styles = StyleSheet.create({
  beam: { position: "absolute", top: 22 },
  lamp: { position: "absolute", top: 10, width: 44, height: 28, alignItems: "center", justifyContent: "center" },
  lampGrid: {
    width: 36,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    padding: 3,
    borderRadius: 4,
    backgroundColor: "#1b2236",
    shadowColor: `rgb(${LIGHT})`,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  lampBulb: { width: 8, height: 8, borderRadius: 2, backgroundColor: `rgb(${LIGHT})` },
  mote: { position: "absolute", backgroundColor: `rgb(${LIGHT})` },
  pitchWrap: { position: "absolute", transform: [{ perspective: 700 }, { rotateX: "62deg" }] },
  pitchFade: { position: "absolute", left: 0, right: 0, bottom: 0 },
  flare: { backgroundColor: `rgb(${LIGHT})` },
});
