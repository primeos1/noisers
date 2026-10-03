// The depth layer: the floodlit backdrop behind every screen, glass
// surfaces, cards that tilt toward your finger, a 3D cover-flow carousel,
// scores that flip over when they change, and a stretchy parallax header.
// Everything here honours the system's Reduce Motion setting.

import { memo, useEffect, useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FlipInXUp,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { colors, glass, radius, sheen, springs } from "../theme";

// ---- Backdrop --------------------------------------------------------------

/**
 * Night sky over the pitch: two floodlight glows that drift very slowly and
 * a faint teal bounce off the grass at the bottom. Sits behind screen content.
 */
export const Backdrop = memo(function Backdrop({ intensity = 1 }: { intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    drift.set(withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [drift, reduced]);

  const left = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0, 1], [-24, 18]) }, { translateY: interpolate(drift.value, [0, 1], [0, 30]) }],
  }));
  const right = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0, 1], [20, -26]) }, { translateY: interpolate(drift.value, [0, 1], [24, -8]) }],
  }));

  const glow = Math.max(width, 360) * 1.1;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[colors.inkDeep, colors.ink, "#0b1120"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.glow, { width: glow, height: glow, left: -glow * 0.45, top: -glow * 0.5, opacity: 0.9 * intensity }, left]}>
        <Glow color="255,244,214" id="l" />
      </Animated.View>
      <Animated.View style={[styles.glow, { width: glow, height: glow, right: -glow * 0.5, top: -glow * 0.35, opacity: 0.55 * intensity }, right]}>
        <Glow color="120,170,255" id="r" />
      </Animated.View>
      <View style={[styles.glow, { width: width * 1.6, height: width * 0.9, left: -width * 0.3, top: height - width * 0.45, opacity: 0.5 * intensity }]}>
        <Glow color="47,158,138" id="b" />
      </View>
    </View>
  );
});

function Glow({ color, id }: { color: string; id: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={`rgb(${color})`} stopOpacity="0.16" />
          <Stop offset="0.45" stopColor={`rgb(${color})`} stopOpacity="0.06" />
          <Stop offset="1" stopColor={`rgb(${color})`} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${id})`} />
    </Svg>
  );
}

// ---- Glass -----------------------------------------------------------------

/**
 * A translucent surface with a lit top edge. `blur` uses a real backdrop blur
 * on iOS — keep it for floating layers (it costs more than a tint).
 */
export function Glass({
  children,
  style,
  blur = false,
  tint,
  rounded = radius.lg,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  blur?: boolean;
  tint?: string;
  rounded?: number;
}) {
  return (
    <View style={[styles.glass, { borderRadius: rounded }, tint ? { backgroundColor: tint } : null, style]}>
      {blur && Platform.OS === "ios" ? <BlurView intensity={40} tint="systemChromeMaterialDark" style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient colors={sheen} style={styles.sheen} pointerEvents="none" />
      {children}
    </View>
  );
}

// ---- Tilt ------------------------------------------------------------------

export const haptic = {
  tap: () => Platform.OS !== "web" && Haptics.selectionAsync().catch(() => undefined),
  soft: () => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined),
  success: () => Platform.OS !== "web" && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
};

/**
 * A pressable card that leans toward the point you touch — the corner under
 * your finger sinks in — then springs back flat when you let go.
 */
export function Tilt({
  children,
  onPress,
  onLongPress,
  style,
  containerStyle,
  max = 9,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Layout for the outer touch area — flex, widths — when the card sits in a row. */
  containerStyle?: StyleProp<ViewStyle>;
  max?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "link" | "none";
}) {
  const reduced = useReducedMotion();
  const box = useSharedValue({ w: 1, h: 1 });
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }, { scale: scale.value }],
  }));

  function pressIn(e: GestureResponderEvent) {
    scale.set(withSpring(0.975, springs.press));
    if (reduced) return;
    const { locationX: x, locationY: y } = e.nativeEvent;
    const { w, h } = box.value;
    ry.set(withSpring((x / w - 0.5) * 2 * max, springs.press));
    rx.set(withSpring((0.5 - y / h) * 2 * max, springs.press));
  }

  function pressOut() {
    scale.set(withSpring(1, springs.settle));
    rx.set(withSpring(0, springs.settle));
    ry.set(withSpring(0, springs.settle));
  }

  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.tap();
              onPress();
            }
          : undefined
      }
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      style={containerStyle}
      onLayout={(e: LayoutChangeEvent) => {
        box.value = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 };
      }}
      accessibilityRole={onPress ? accessibilityRole : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---- Reveal ----------------------------------------------------------------

/** Rises into place on first render, staggered by `index`. */
export function Reveal({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 45).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

// ---- Flip score ------------------------------------------------------------

/** A number that flips over, scoreboard-style, whenever it changes. */
export function FlipNumber({ value, style }: { value: number | string; style: StyleProp<import("react-native").TextStyle> }) {
  return (
    <View style={styles.flipBox}>
      <Animated.Text key={String(value)} entering={FlipInXUp.springify().damping(14)} style={style}>
        {value}
      </Animated.Text>
    </View>
  );
}

// ---- Pulse -----------------------------------------------------------------

/** A soft ring that breathes around live content. */
export function PulseRing({ color = colors.loss, rounded = radius.lg }: { color?: string; rounded?: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    v.set(withRepeat(withSequence(withTiming(1, { duration: 1100 }), withTiming(0, { duration: 1100 })), -1));
  }, [reduced, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + v.value * 0.55 }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: rounded, borderWidth: 1.5, borderColor: color }, style]} />;
}

// ---- Cover flow ------------------------------------------------------------

/**
 * A horizontal carousel whose side cards swing away in 3D, like an album
 * shelf. Cards snap to the centre.
 */
export function CoverFlow<T>({
  data,
  itemWidth,
  renderItem,
  keyOf,
  gap = 14,
  height,
}: {
  data: T[];
  itemWidth: number;
  renderItem: (item: T, index: number) => ReactNode;
  keyOf: (item: T) => string | number;
  gap?: number;
  height?: number;
}) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const step = itemWidth + gap;
  const side = (width - itemWidth) / 2;

  return (
    <Animated.ScrollView
      horizontal
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: side, gap, paddingVertical: 12 }}
      style={[styles.bleed, height ? { height } : null]}
    >
      {data.map((item, i) => (
        <FlowItem key={keyOf(item)} index={i} step={step} x={x} width={itemWidth}>
          {renderItem(item, i)}
        </FlowItem>
      ))}
    </Animated.ScrollView>
  );
}

function FlowItem({ index, step, x, width, children }: { index: number; step: number; x: SharedValue<number>; width: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const d = (x.value - index * step) / step; // 0 at centre, ±1 one card away
    if (reduced) return { opacity: interpolate(Math.abs(d), [0, 1.5], [1, 0.6], "clamp") };
    return {
      opacity: interpolate(Math.abs(d), [0, 2], [1, 0.45], "clamp"),
      transform: [
        { perspective: 1000 },
        { translateX: interpolate(d, [-2, 0, 2], [-step * 0.35, 0, step * 0.35], "clamp") },
        { rotateY: `${interpolate(d, [-1.5, 0, 1.5], [-42, 0, 42], "clamp")}deg` },
        { scale: interpolate(Math.abs(d), [0, 1], [1, 0.84], "clamp") },
      ],
    };
  });
  return <Animated.View style={[{ width }, style]}>{children}</Animated.View>;
}

// ---- Parallax header -------------------------------------------------------

/**
 * Scroll body with a hero that moves at half speed and stretches when you
 * pull down. `hero` fills a box `heroHeight` tall behind the top of the page.
 */
export function useParallax(heroHeight: number) {
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value < 0 ? y.value / 2 : -y.value * 0.45 },
      { scale: y.value < 0 ? 1 + -y.value / heroHeight : 1 },
    ],
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, heroHeight * 0.7], [1, 0], "clamp") }));
  return { y, onScroll, heroStyle, fadeStyle };
}

// ---- Shimmer ---------------------------------------------------------------

/** Placeholder block with a moving sheen while something loads. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1));
  }, [reduced, t]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(t.value, [0, 1], [-w, w]) }] }));
  return (
    <View style={[styles.skeleton, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Animated.View style={[StyleSheet.absoluteFill, band]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.06)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute" },
  glass: { backgroundColor: glass.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, overflow: "hidden" },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 90 },
  flipBox: { overflow: "visible" },
  bleed: { marginHorizontal: -16, flexGrow: 0 },
  skeleton: { backgroundColor: glass.raised, borderRadius: radius.md, overflow: "hidden" },
});
