// The floating tab bar: a glass pill that hovers above the home indicator,
// with a lit slot that slides under the active tab. Icons fill in when
// selected and the Matches tab carries a pulsing "Live" tag during a game.

import { useEffect, useState, type ComponentProps } from "react";
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { Tabs } from "expo-router/js-tabs";
import { haptic } from "./depth";
import { Text as Txt } from "react-native";
import { colors, fonts, glass, radius, sheen, shadow, springs } from "../theme";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];
type IonName = keyof typeof Ionicons.glyphMap;

export const TAB_BAR_HEIGHT = 64;
/** Room tab screens leave at the bottom so content clears the floating bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 24;
}

const ICONS: Record<string, { on: IonName; off: IonName }> = {
  index: { on: "home", off: "home-outline" },
  squad: { on: "shirt", off: "shirt-outline" },
  matches: { on: "football", off: "football-outline" },
  stats: { on: "stats-chart", off: "stats-chart-outline" },
  club: { on: "shield-half", off: "shield-half-outline" },
};

export function TabBar({ state, descriptors, navigation, live }: TabBarProps & { live: boolean }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const slot = width / state.routes.length;
  const x = useSharedValue(0);

  useEffect(() => {
    const to = state.index * slot;
    x.set(reduced || !slot ? to : withSpring(to, springs.settle));
  }, [state.index, slot, reduced, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - PAD * 2)}>
        <View style={styles.clip} pointerEvents="none">
          {Platform.OS === "ios" ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.solid]} />
          )}
          <LinearGradient colors={sheen} style={StyleSheet.absoluteFill} />
        </View>

        {slot ? (
          <Animated.View pointerEvents="none" style={[styles.indicator, { width: slot }, indicator]}>
            <View style={styles.indicatorFill} />
          </Animated.View>
        ) : null}

        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key];
          const focused = state.index === i;
          const label = typeof options.title === "string" ? options.title : route.name;
          const icon = ICONS[route.name] ?? { on: "ellipse", off: "ellipse-outline" };
          const color = focused ? colors.paper : colors.mist;

          function onPress() {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.tap();
              navigation.navigate(route.name, route.params);
            }
          }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={route.name === "matches" && live ? `${label}, live match` : label}
              style={styles.tab}
            >
              <View>
                <Ionicons name={focused ? icon.on : icon.off} size={22} color={color} />
                {route.name === "matches" && live ? <LiveTag /> : null}
              </View>
              <Txt style={[styles.label, { color }, focused && styles.labelOn]} numberOfLines={1}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LiveTag() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduced) pulse.set(withRepeat(withTiming(0.35, { duration: 800 }), -1, true));
  }, [pulse, reduced]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveDot, dot]} />
      <Txt style={styles.liveText}>LIVE</Txt>
    </View>
  );
}

const PAD = 6;

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: 520,
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    paddingHorizontal: PAD,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.edgeBright,
    ...shadow.card,
  },
  clip: { ...StyleSheet.absoluteFill, borderRadius: radius.pill, overflow: "hidden" },
  solid: { backgroundColor: "rgba(15,20,36,0.96)" },
  indicator: { position: "absolute", top: PAD, bottom: PAD, left: PAD, paddingHorizontal: 2 },
  indicatorFill: {
    flex: 1,
    borderRadius: radius.pill,
    backgroundColor: "rgba(246,246,243,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.edge,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10.5, letterSpacing: 0.2 },
  labelOn: { fontFamily: fonts.bodySemi },
  live: {
    position: "absolute",
    top: -6,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    backgroundColor: colors.loss,
    borderWidth: 1.5,
    borderColor: colors.inkDeep,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.paper },
  liveText: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.5, color: colors.paper },
});
