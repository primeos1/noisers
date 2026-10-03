// A player's trading card. The face shows the photo, rating and season
// numbers on a foil frame (gold, silver or bronze by rating). The big
// version floats in 3D: it leans with the phone (gyroscope), follows your
// finger when you drag it, catches a moving glare and holo sheen, and flips
// over on tap to show the back.

import { useEffect, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type DerivedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { DeviceMotion } from "expo-sensors";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { resolveMediaUrl } from "../lib/config";
import { isKeeper } from "../lib/derive";
import type { Player } from "../lib/types";
import { colors, fonts, shadow } from "../theme";
import { Txt } from "./ui";
import { haptic } from "./depth";

const crest = require("../../assets/brand/logo-white.png");

export type Tier = "gold" | "silver" | "bronze";

export function tierOf(rating: number): Tier {
  return rating >= 7.5 ? "gold" : rating >= 6.5 ? "silver" : "bronze";
}

const tierFoil: Record<Tier, readonly [string, string, ...string[]]> = {
  gold: ["#fbe9a8", "#d4a93a", "#7d5a1e", "#f0cd6c", "#a8841f"],
  silver: ["#f4f6fb", "#a9b2c6", "#59627a", "#dfe4ee", "#8a93a6"],
  bronze: ["#f2c4a0", "#b4703f", "#5e3519", "#d99a6c", "#8a5130"],
};

const tierInk: Record<Tier, string> = { gold: "#f2d27a", silver: "#e6eaf2", bronze: "#f0b98d" };

export function stockPhoto(id: number) {
  return `https://i.pravatar.cc/400?img=${(id % 70) + 1}`;
}

function photoOf(player: Player) {
  return resolveMediaUrl(player.photoUrl) ?? stockPhoto(player.id);
}

/** Season numbers for the card face — keepers show saves instead of assists. */
function faceStats(player: Player) {
  const keeper = isKeeper(player);
  return [
    { label: "GP", value: player.appearances },
    { label: keeper ? "SV" : "G", value: keeper ? (player.saves ?? 0) : player.goals },
    { label: keeper ? "CS" : "A", value: keeper ? player.cleanSheets : player.assists },
  ];
}

// ---- Static face -----------------------------------------------------------

/** The card front, drawn at any width (height is 1.4×). */
export function CardFace({
  player,
  width,
  tilt,
  badge,
}: {
  player: Player;
  width: number;
  /** Optional tilt (degrees) to drive the parallax, glare and holo. */
  tilt?: { rx: DerivedValue<number>; ry: DerivedValue<number> };
  badge?: ReactNode;
}) {
  const tier = tierOf(player.rating);
  const height = width * 1.4;
  const s = width / 240; // type scales with the card
  const ink = tierInk[tier];

  const photoStyle = useAnimatedStyle(() => {
    if (!tilt) return {};
    return { transform: [{ translateX: -tilt.ry.value * 0.8 }, { translateY: tilt.rx.value * 0.8 }, { scale: 1.08 }] };
  });
  const textStyle = useAnimatedStyle(() => {
    if (!tilt) return {};
    return { transform: [{ translateX: tilt.ry.value * 0.5 }, { translateY: -tilt.rx.value * 0.5 }] };
  });
  const glareStyle = useAnimatedStyle(() => {
    if (!tilt) return { opacity: 0.35 };
    const mag = Math.min((Math.abs(tilt.rx.value) + Math.abs(tilt.ry.value)) / 20, 1);
    return {
      opacity: 0.25 + mag * 0.55,
      transform: [{ translateX: tilt.ry.value * 9 }, { translateY: -tilt.rx.value * 9 }, { rotate: "25deg" }],
    };
  });
  const holoStyle = useAnimatedStyle(() => {
    if (!tilt) return { opacity: 0 };
    const mag = Math.min((Math.abs(tilt.rx.value) + Math.abs(tilt.ry.value)) / 18, 1);
    return { opacity: mag * 0.5, transform: [{ translateX: -tilt.ry.value * 6 }, { translateY: tilt.rx.value * 6 }] };
  });

  return (
    <LinearGradient
      colors={tierFoil[tier]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.frame, { width, height, borderRadius: 18 * s, padding: 3 * s }]}
    >
      <View style={[styles.inner, { borderRadius: 15 * s }]}>
        <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
          <Image source={{ uri: photoOf(player) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={String(player.id)} />
        </Animated.View>
        <LinearGradient
          colors={["rgba(10,14,26,0.85)", "rgba(10,14,26,0.35)", "rgba(10,14,26,0)", "rgba(10,14,26,0.25)", "rgba(10,14,26,0.97)"]}
          locations={[0, 0.16, 0.34, 0.55, 0.86]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={[styles.holo, holoStyle]}>
          <LinearGradient
            colors={["rgba(47,158,138,0.0)", "rgba(47,158,138,0.45)", "rgba(212,169,58,0.45)", "rgba(194,59,107,0.45)", "rgba(91,155,213,0.45)", "rgba(91,155,213,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, styles.content, { padding: 14 * s }, textStyle]}>
          <View style={styles.top}>
            <View>
              <Txt style={[styles.rating, { fontSize: 44 * s, lineHeight: 44 * s, color: ink }]}>{player.rating.toFixed(1)}</Txt>
              <Txt style={[styles.pos, { fontSize: 15 * s, color: ink }]}>{player.position}</Txt>
            </View>
            <Image source={crest} style={{ width: 26 * s, height: 26 * s, opacity: 0.85 }} contentFit="contain" />
          </View>

          <View style={styles.bottom}>
            {badge}
            <Txt style={[styles.number, { fontSize: 15 * s, color: ink }]}>#{player.number}</Txt>
            <Txt style={[styles.name, { fontSize: 26 * s, lineHeight: 27 * s }]} numberOfLines={1} adjustsFontSizeToFit>
              {player.name.toUpperCase()}
            </Txt>
            <View style={[styles.rule, { backgroundColor: ink, marginVertical: 7 * s }]} />
            <View style={styles.stats}>
              {faceStats(player).map((st) => (
                <View key={st.label} style={styles.stat}>
                  <Txt style={[styles.statValue, { fontSize: 20 * s, lineHeight: 22 * s }]}>{st.value}</Txt>
                  <Txt style={[styles.statLabel, { fontSize: 10 * s, color: ink }]}>{st.label}</Txt>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.glare, { width: width * 0.7, height: height * 1.6, left: width * 0.15, top: -height * 0.3 }, glareStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.28)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

// ---- Floating 3D card ------------------------------------------------------

const MAX_DRAG = 16;
const MAX_MOTION = 7;

function clamp(v: number, lo: number, hi: number) {
  "worklet";
  return Math.min(Math.max(v, lo), hi);
}

/** Follows the phone's tilt, relative to how it was held when the card appeared. */
function useMotionTilt(enabled: boolean) {
  const mx = useSharedValue(0);
  const my = useSharedValue(0);
  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;
    let sub: { remove: () => void } | null = null;
    let base: { beta: number; gamma: number } | null = null;
    let cancelled = false;
    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (!ok || cancelled) return;
        DeviceMotion.setUpdateInterval(33);
        sub = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation) return;
          base ??= { beta: rotation.beta, gamma: rotation.gamma };
          // Ease the neutral point toward how the phone is held now, so the
          // card settles flat again after a while.
          base.beta += (rotation.beta - base.beta) * 0.01;
          base.gamma += (rotation.gamma - base.gamma) * 0.01;
          const deg = 180 / Math.PI;
          mx.set(withTiming(clamp(-(rotation.beta - base.beta) * deg * 0.6, -MAX_MOTION, MAX_MOTION), { duration: 80 }));
          my.set(withTiming(clamp((rotation.gamma - base.gamma) * deg * 0.6, -MAX_MOTION, MAX_MOTION), { duration: 80 }));
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, mx, my]);
  return { mx, my };
}

/**
 * The hero card on a profile. Drag to turn it in your hand, tap to flip it
 * over to `back`.
 */
export function HoloCard({ player, width, back, badge }: { player: Player; width: number; back?: ReactNode; badge?: ReactNode }) {
  const reduced = useReducedMotion();
  const height = width * 1.4;
  const { mx, my } = useMotionTilt(!reduced);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const flip = useSharedValue(0);
  const [flipped, setFlipped] = useState(false);

  const rx = useDerivedValue(() => dx.value + mx.value);
  const ry = useDerivedValue(() => dy.value + my.value);

  const pan = Gesture.Pan()
    .enabled(!reduced)
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      dy.value = clamp(e.translationX / 7, -MAX_DRAG, MAX_DRAG);
      dx.value = clamp(-e.translationY / 7, -MAX_DRAG, MAX_DRAG);
    })
    .onEnd(() => {
      dx.set(withSpring(0, { damping: 9, stiffness: 120 }));
      dy.set(withSpring(0, { damping: 9, stiffness: 120 }));
    });

  function toggle() {
    if (!back) return;
    haptic.soft();
    setFlipped((f) => {
      flip.set(withSpring(f ? 0 : 1, { damping: 16, stiffness: 110 }));
      return !f;
    });
  }

  const tap = Gesture.Tap().runOnJS(true).onEnd(toggle);
  const gesture = Gesture.Race(pan, tap);

  // One combined tilt drives the face's parallax, glare and holo.
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 1100 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -ry.value * 1.4 }, { translateY: 18 + rx.value * 1.2 }, { scaleX: 0.86 }],
    opacity: 0.55,
  }));

  return (
    <View style={{ width, height: height + 24, alignItems: "center" }}>
      {Platform.OS === "ios" ? (
        <Animated.View pointerEvents="none" style={[styles.floorShadow, { width, height: height * 0.9, top: height * 0.1, borderRadius: 24 }, shadowStyle]} />
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[{ width, height }, tiltStyle]}
          accessible
          accessibilityRole={back ? "button" : "image"}
          accessibilityLabel={`${player.name}, number ${player.number}, ${player.position}, rated ${player.rating.toFixed(2)}`}
          accessibilityHint={back ? (flipped ? "Shows the front of the card" : "Turns the card over") : undefined}
          onAccessibilityTap={toggle}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.face, frontStyle]}>
            <CardFace player={player} width={width} tilt={{ rx, ry }} badge={badge} />
          </Animated.View>
          {back ? (
            <Animated.View style={[StyleSheet.absoluteFill, styles.face, backStyle]}>
              <CardBack player={player} width={width}>
                {back}
              </CardBack>
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function CardBack({ player, width, children }: { player: Player; width: number; children: ReactNode }) {
  const tier = tierOf(player.rating);
  const s = width / 240;
  return (
    <LinearGradient
      colors={tierFoil[tier]}
      start={{ x: 1, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.frame, { width, height: width * 1.4, borderRadius: 18 * s, padding: 3 * s }]}
    >
      <LinearGradient colors={["#18213a", colors.ink]} style={[styles.inner, styles.backInner, { borderRadius: 15 * s, padding: 16 * s }]}>
        <Image source={crest} style={[styles.backCrest, { width: width * 0.7, height: width * 0.7 }]} contentFit="contain" />
        {children}
      </LinearGradient>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  frame: { ...shadow.card },
  inner: { flex: 1, overflow: "hidden", backgroundColor: colors.inkRaised },
  content: { justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rating: { fontFamily: fonts.displayHeavy, fontVariant: ["tabular-nums"], textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  pos: { fontFamily: fonts.display, letterSpacing: 2, marginTop: 2, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  bottom: { alignItems: "center" },
  number: { fontFamily: fonts.display, letterSpacing: 1 },
  name: { fontFamily: fonts.displayHeavy, color: colors.paper, letterSpacing: 0.5, textAlign: "center" },
  rule: { height: 1, width: "70%", opacity: 0.5 },
  stats: { flexDirection: "row", justifyContent: "space-around", alignSelf: "stretch" },
  stat: { alignItems: "center", minWidth: 40 },
  statValue: { fontFamily: fonts.display, color: colors.paper, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: fonts.bodySemi, letterSpacing: 1 },
  glare: { position: "absolute" },
  holo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  face: { backfaceVisibility: "hidden" },
  floorShadow: { position: "absolute", backgroundColor: "rgba(0,0,0,0.6)", shadowColor: "#000", shadowOpacity: 0.9, shadowRadius: 26 },
  backInner: { justifyContent: "center" },
  backCrest: { position: "absolute", alignSelf: "center", opacity: 0.06 },
});
