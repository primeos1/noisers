// Building blocks for every screen — the native counterparts of
// frontend/src/components/portal/ui.tsx: grouped glass lists, a sliding
// segmented control, result chips, referee-card pips and the rating meter.
// Each screen sits on the floodlit Backdrop from ./depth.

import { Children, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarSpace } from "./TabBar";
import { colors, fonts, glass, radius, sheen, space, springs } from "../theme";
import { resolveMediaUrl } from "../lib/config";
import { RATING_MAX, RATING_MIN, type Result } from "../lib/derive";
import { membershipLabels, type Membership, type Player } from "../lib/types";
import { Backdrop, haptic } from "./depth";

type IconName = keyof typeof Ionicons.glyphMap;

export function Txt({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.txt, style]} />;
}

/**
 * Scrollable screen body on the floodlit backdrop, with pull-to-refresh.
 * On iOS the scroll view insets itself under the glass header and tab bar;
 * elsewhere `topInset` pads tab screens that have no header above them.
 */
export function Screen({
  children,
  onRefresh,
  topInset = false,
  contentStyle,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  /** true for tab screens; "header" for screens under a transparent header. */
  topInset?: boolean | "header";
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    haptic.soft();
    await onRefresh().finally(() => setRefreshing(false));
  }

  return (
    <View style={styles.screen}>
      <Backdrop />
      <ScrollView
        style={styles.flex}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.screenContent,
          topInset && Platform.OS !== "ios"
            ? { paddingTop: insets.top + (topInset === "header" ? 64 : Platform.OS === "web" ? 84 : space.md) }
            : null,
          topInset === true ? { paddingBottom: tabBarSpace } : null,
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.paper} colors={[colors.ink]} progressBackgroundColor={colors.paper} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Big display title with an optional small-caps eyebrow above it. */
export function PageTitle({ title, sub, eyebrow, right }: { title: string; sub?: ReactNode; eyebrow?: string; right?: ReactNode }) {
  return (
    <View style={styles.pageTitle}>
      <View style={styles.pageTitleRow}>
        <View style={styles.flex}>
          {eyebrow ? <Txt style={styles.eyebrow}>{eyebrow}</Txt> : null}
          <Txt style={styles.pageTitleText} accessibilityRole="header">
            {title}
          </Txt>
        </View>
        {right}
      </View>
      {sub ? typeof sub === "string" ? <Txt style={styles.pageSub}>{sub}</Txt> : sub : null}
    </View>
  );
}

/** A section heading with an optional "See all"-style link on the right. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link" style={styles.sectionAction}>
          <Txt style={styles.sectionActionText}>{action}</Txt>
          <Ionicons name="chevron-forward" size={14} color={colors.paperDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Rounded glass group of rows, iOS-settings style, with an optional heading. */
export function Group({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title || aside ? (
        <View style={styles.groupHead}>
          {title ? (
            <Txt style={styles.groupTitle} accessibilityRole="header">
              {title}
            </Txt>
          ) : (
            <View />
          )}
          {aside !== undefined && aside !== null ? (
            typeof aside === "string" || typeof aside === "number" ? <Txt style={styles.groupAside}>{aside}</Txt> : aside
          ) : null}
        </View>
      ) : null}
      <View style={styles.groupBody}>
        <LinearGradient colors={sheen} style={styles.sheen} pointerEvents="none" />
        {rows.map((row, i) => (
          <View key={i} style={i > 0 ? styles.divider : null}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

export function Row({
  onPress,
  onLongPress,
  children,
  chevron = !!onPress,
  style,
  accessibilityLabel,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {children}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={colors.mist} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null, style]}
    >
      {body}
    </Pressable>
  );
}

/** Rounded icon tile used at the start of rows and on hub tiles. */
export function IconTile({ name, tone = colors.paper, size = 34 }: { name: IconName; tone?: string; size?: number }) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: `${tone}22`, borderColor: `${tone}40` }]}>
      <Ionicons name={name} size={size * 0.52} color={tone} />
    </View>
  );
}

/** A handful of figures side by side on one glass panel. */
export function Figures({ items }: { items: { label: string; value: string | number; tone?: string }[] }) {
  return (
    <View style={styles.figures}>
      <LinearGradient colors={sheen} style={styles.sheen} pointerEvents="none" />
      {items.map((f, i) => (
        <View key={f.label} style={[styles.figure, i > 0 ? styles.figureDivider : null]}>
          <Txt style={[styles.figureValue, { color: f.tone ?? colors.paper }]} numberOfLines={1} adjustsFontSizeToFit>
            {f.value}
          </Txt>
          <Txt style={styles.figureLabel}>{f.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** A segmented control whose white pill slides to the chosen option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    options.findIndex((o) => o.value === value),
    0,
  );
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(index * segment, springs.press));
  }, [index, segment, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.segmented} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segment > 0 ? <Animated.View style={[styles.segmentPill, { width: segment }, pill]} /> : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) haptic.tap();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}
          >
            <Txt style={[styles.segmentText, active ? styles.segmentTextActive : null]} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal scrolling filter chips. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; tone?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsBleed} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.filterChip, active ? styles.filterChipActive : null]}
          >
            {o.tone ? <View style={[styles.filterDot, { backgroundColor: o.tone }]} /> : null}
            <Txt style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const resultColors: Record<Result, { bg: string; fg: string; label: string }> = {
  W: { bg: colors.win, fg: colors.ink, label: "Won" },
  D: { bg: colors.draw, fg: colors.ink, label: "Drew" },
  L: { bg: colors.loss, fg: colors.paper, label: "Lost" },
};

export function ResultChip({ result, size = "sm" }: { result: Result | null; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? styles.chipLg : styles.chipSm;
  const label = size === "lg" ? styles.chipTextLg : styles.chipTextSm;
  if (!result) {
    return (
      <View style={[styles.chip, dims, { backgroundColor: colors.inkLine }]} accessibilityLabel="Not finished">
        <Txt style={[label, { color: colors.mist }]}>–</Txt>
      </View>
    );
  }
  const tone = resultColors[result];
  return (
    <View style={[styles.chip, dims, { backgroundColor: tone.bg, shadowColor: tone.bg }, styles.chipGlow]} accessibilityLabel={tone.label}>
      <Txt style={[label, { color: tone.fg }]}>{result}</Txt>
    </View>
  );
}

/** A referee card drawn as a little rectangle. */
export function RefCard({ type, size = "sm" }: { type: "yellow" | "red"; size?: "sm" | "md" }) {
  return (
    <View
      style={[size === "md" ? styles.refCardMd : styles.refCardSm, { backgroundColor: type === "red" ? colors.loss : colors.draw }]}
      accessibilityLabel={`${type} card`}
    />
  );
}

export function CardPips({ yellow, red }: { yellow: number; red: number }) {
  if (!yellow && !red) return null;
  return (
    <View style={styles.pips} accessibilityLabel={`${yellow} yellow, ${red} red`}>
      {yellow > 0 ? (
        <View style={styles.pip}>
          <RefCard type="yellow" />
          {yellow > 1 ? <Txt style={styles.pipCount}>{yellow}</Txt> : null}
        </View>
      ) : null}
      {red > 0 ? (
        <View style={styles.pip}>
          <RefCard type="red" />
          {red > 1 ? <Txt style={styles.pipCount}>{red}</Txt> : null}
        </View>
      ) : null}
    </View>
  );
}

export function LiveTag() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })), -1));
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.live} accessibilityLabel="Live">
      <Animated.View style={[styles.liveDot, dot]} />
      <Txt style={styles.liveText}>Live</Txt>
    </View>
  );
}

/** Gold bar that fills to the rating when it first appears. */
export function RatingMeter({ rating }: { rating: number }) {
  const pct = Math.min(Math.max(((rating - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100, 0), 100);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: RATING_MIN, max: RATING_MAX, now: rating }} accessibilityLabel="Rating">
      <Bar value={pct} max={100} tone={colors.gold} thick />
      <View style={styles.meterScale}>
        <Txt style={styles.meterLabel}>{RATING_MIN.toFixed(1)}</Txt>
        <Txt style={styles.meterLabel}>{RATING_MAX.toFixed(1)}</Txt>
      </View>
    </View>
  );
}

/** Horizontal bar used for leaderboards and per-match-day totals; grows in on mount. */
export function Bar({ value, max, tone = colors.paper, thick = false }: { value: number; max: number; tone?: string; thick?: boolean }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withTiming(pct, { duration: 700 }));
  }, [grow, pct]);
  const fill = useAnimatedStyle(() => ({ width: `${grow.value}%` }));
  return (
    <View style={[styles.track, thick ? null : styles.trackThin]}>
      <Animated.View style={[styles.fill, fill]}>
        <LinearGradient colors={[`${tone}99`, tone]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export function Empty({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.empty}>
      {icon ? <Ionicons name={icon} size={30} color={colors.mist} style={styles.emptyIcon} /> : null}
      {typeof children === "string" ? <Txt style={styles.emptyText}>{children}</Txt> : children}
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.paper} />
      <Txt style={[styles.emptyText, styles.loadingText]}>{label}</Txt>
    </View>
  );
}

/** Shown above content when the last refresh couldn't reach the API. */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.loss} />
      <Txt style={styles.errorText}>{message}</Txt>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Txt style={styles.errorRetry}>Retry</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  busy = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "gold";
  disabled?: boolean;
  busy?: boolean;
  icon?: IconName;
}) {
  const fg = variant === "primary" || variant === "gold" ? colors.ink : variant === "danger" ? colors.loss : colors.paper;
  const scale = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onPressIn={() => scale.set(withSpring(0.96, springs.press))}
      onPressOut={() => scale.set(withSpring(1, springs.settle))}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
    >
      <Animated.View
        style={[
          styles.button,
          variant === "primary" ? styles.buttonPrimary : variant === "gold" ? styles.buttonGold : styles.buttonSecondary,
          disabled ? styles.buttonDisabled : null,
          press,
        ]}
      >
        {variant === "gold" ? (
          <LinearGradient colors={["#f7e3a1", colors.gold, "#b88a2a"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        ) : null}
        {busy ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Txt style={[styles.buttonText, { color: fg }]}>{label}</Txt>
      </Animated.View>
    </Pressable>
  );
}

/** Stock face for a player without an uploaded photo — the same pick the
 *  web makes (frontend/src/lib/clubData.ts stockPhoto). */
function stockPhoto(number: number) {
  return `https://i.pravatar.cc/400?img=${(number % 70) + 1}`;
}

/** The player's photo, a stock face when none was uploaded, or a silhouette
 *  if the image fails to load. `ring` draws a coloured outline (e.g. gold). */
export function Avatar({ player, size = 40, rounded = size / 2, ring }: { player: Player; size?: number; rounded?: number; ring?: string }) {
  const [failed, setFailed] = useState(false);
  const uri = resolveMediaUrl(player.photoUrl) ?? stockPhoto(player.id);
  const box = { width: size, height: size, borderRadius: rounded };
  const ringStyle = ring ? { borderWidth: 2, borderColor: ring } : null;
  if (!uri || failed) {
    return (
      <View style={[styles.avatarFallback, box, ringStyle]} accessibilityLabel={player.name}>
        <Ionicons name="person" size={size * 0.5} color={colors.mist} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.avatarImage, box, ringStyle]}
      contentFit="cover"
      transition={150}
      recyclingKey={uri}
      onError={() => setFailed(true)}
      accessibilityLabel={player.name}
    />
  );
}

export const text = StyleSheet.create({
  display: { fontFamily: fonts.display, color: colors.paper },
  heavy: { fontFamily: fonts.displayHeavy, color: colors.paper },
  body: { fontFamily: fonts.body, color: colors.paper, fontSize: 15 },
  semi: { fontFamily: fonts.bodySemi, color: colors.paper, fontSize: 15 },
  small: { fontFamily: fonts.body, color: colors.mist, fontSize: 12 },
  dim: { fontFamily: fonts.body, color: colors.paperDim, fontSize: 14 },
  eyebrow: { fontFamily: fonts.bodySemi, color: colors.paperDim, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
  tabular: { fontVariant: ["tabular-nums"] } as TextStyle,
});

const styles = StyleSheet.create({
  txt: { fontFamily: fonts.body, color: colors.paper },
  flex: { flex: 1, minWidth: 0 },
  screen: { flex: 1, backgroundColor: colors.ink },
  screenContent: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 64 },
  sheen: { position: "absolute", top: 0, left: 0, right: 0, height: 70 },

  pageTitle: { marginBottom: space.xl },
  pageTitleRow: { flexDirection: "row", alignItems: "flex-end", gap: space.md },
  eyebrow: { ...StyleSheet.flatten(text.eyebrow), marginBottom: 4 },
  pageTitleText: { fontFamily: fonts.displayHeavy, fontSize: 44, lineHeight: 46, color: colors.paper, letterSpacing: 0.3 },
  pageSub: { marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.paperDim },

  sectionHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: space.md, paddingHorizontal: 2 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.paper, letterSpacing: 0.3 },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  sectionActionText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim },

  group: { marginBottom: space.xl },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: space.sm, paddingHorizontal: 4, gap: space.md },
  groupTitle: { ...StyleSheet.flatten(text.eyebrow) },
  groupAside: { fontSize: 12, color: colors.mist },
  groupBody: { backgroundColor: glass.surface, borderRadius: radius.lg, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.07)", marginLeft: space.lg },

  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowPressed: { backgroundColor: glass.pressed },

  iconTile: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },

  figures: {
    flexDirection: "row",
    backgroundColor: glass.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.edge,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    marginBottom: space.xl,
    overflow: "hidden",
  },
  figure: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  figureDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(255,255,255,0.08)" },
  figureValue: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 36, fontVariant: ["tabular-nums"] },
  figureLabel: { marginTop: 4, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.mist, textAlign: "center" },

  segmented: { flexDirection: "row", backgroundColor: glass.surface, borderRadius: radius.pill, padding: 4, marginBottom: space.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  segmentPill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.pill, backgroundColor: colors.paper },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, minHeight: 38, paddingHorizontal: 6 },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim },
  segmentTextActive: { color: colors.ink },

  chipsBleed: { marginHorizontal: -space.lg, marginBottom: space.lg, flexGrow: 0 },
  chips: { gap: space.sm, paddingHorizontal: space.lg },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, borderRadius: radius.pill, paddingHorizontal: 14, backgroundColor: glass.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  filterChipActive: { backgroundColor: colors.paper, borderColor: colors.paper },
  filterDot: { width: 7, height: 7, borderRadius: 4 },
  filterChipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim },
  filterChipTextActive: { color: colors.ink },

  chip: { alignItems: "center", justifyContent: "center" },
  chipGlow: { shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  chipSm: { width: 28, height: 28, borderRadius: 8 },
  chipLg: { width: 40, height: 40, borderRadius: 12 },
  chipTextSm: { fontFamily: fonts.displayHeavy, fontSize: 15 },
  chipTextLg: { fontFamily: fonts.displayHeavy, fontSize: 21 },

  refCardSm: { width: 10, height: 14, borderRadius: 2 },
  refCardMd: { width: 13, height: 18, borderRadius: 3 },
  pips: { flexDirection: "row", alignItems: "center", gap: 6 },
  pip: { flexDirection: "row", alignItems: "center", gap: 3 },
  pipCount: { fontSize: 12, color: colors.paperDim },

  live: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(194,59,107,0.18)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(194,59,107,0.5)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.loss },
  liveText: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#ff6f9f" },

  track: { height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  trackThin: { height: 5 },
  fill: { height: "100%", borderRadius: 4, overflow: "hidden" },
  meterScale: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  meterLabel: { fontSize: 10, color: colors.mist },

  empty: { backgroundColor: glass.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, paddingHorizontal: space.xl, paddingVertical: 40, alignItems: "center", marginBottom: space.xl },
  emptyIcon: { marginBottom: space.md },
  emptyText: { fontSize: 14, color: colors.paperDim, textAlign: "center", lineHeight: 20 },
  emptyAction: { marginTop: space.lg },
  loadingText: { marginTop: space.md },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "rgba(194,59,107,0.14)", borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(194,59,107,0.4)", padding: space.md, marginBottom: space.lg },
  errorText: { flex: 1, fontSize: 13, color: colors.paperDim, lineHeight: 18 },
  errorRetry: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper },

  button: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.xl, overflow: "hidden" },
  buttonPrimary: { backgroundColor: colors.paper },
  buttonGold: { backgroundColor: colors.gold },
  buttonSecondary: { backgroundColor: glass.raised, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edgeBright },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 15 },

  avatarFallback: { backgroundColor: colors.inkLine, alignItems: "center", justifyContent: "center" },
  avatarImage: { backgroundColor: colors.inkLine },
});

/** Teal "Member" / gold "Guest member" pill — matches the website's badge. */
export function MembershipBadge({ membership }: { membership: Membership }) {
  const tone = membership === "guest" ? colors.draw : colors.win;
  return (
    <View style={[badgeStyles.badge, { borderColor: tone, backgroundColor: `${tone}26` }]}>
      <Txt style={[badgeStyles.text, { color: tone }]}>{membershipLabels[membership]}</Txt>
    </View>
  );
}

/** A small coloured pill with optional icon — statuses like "Injured". */
export function Pill({ label, tone, icon, solid = false }: { label: string; tone: string; icon?: IconName; solid?: boolean }) {
  return (
    <View style={[badgeStyles.badge, badgeStyles.pill, { borderColor: `${tone}88`, backgroundColor: solid ? "rgba(10,14,26,0.88)" : `${tone}22` }]}>
      {icon ? <Ionicons name={icon} size={11} color={tone} /> : null}
      <Txt style={[badgeStyles.text, { color: tone }]}>{label}</Txt>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
