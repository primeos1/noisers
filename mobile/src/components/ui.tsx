// Building blocks for every screen — the native counterparts of
// frontend/src/components/portal/ui.tsx: grouped lists, a segmented
// control, result chips, referee-card pips and the rating meter.

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, space } from "../theme";
import { resolveMediaUrl } from "../lib/config";
import { RATING_MAX, RATING_MIN, type Result } from "../lib/derive";
import { membershipLabels, type Membership, type Player } from "../lib/types";

export function Txt({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.txt, style]} />;
}

/** Scrollable screen body with pull-to-refresh. `topInset` pads for tab
 *  screens that have no native header above them. */
export function Screen({
  children,
  onRefresh,
  topInset = false,
}: {
  children: ReactNode;
  onRefresh?: () => Promise<void>;
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh().finally(() => setRefreshing(false));
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, topInset ? { paddingTop: insets.top + space.md } : null]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.paper} colors={[colors.ink]} progressBackgroundColor={colors.paper} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <View style={styles.pageTitle}>
      <Txt style={styles.pageTitleText} accessibilityRole="header">
        {title}
      </Txt>
      {sub ? typeof sub === "string" ? <Txt style={styles.pageSub}>{sub}</Txt> : sub : null}
    </View>
  );
}

/** Rounded group of rows, iOS-settings style, with an optional heading. */
export function Group({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {title || aside ? (
        <View style={styles.groupHead}>
          {title ? <Txt style={styles.groupTitle} accessibilityRole="header">{title}</Txt> : <View />}
          {aside !== undefined && aside !== null ? (
            typeof aside === "string" || typeof aside === "number" ? <Txt style={styles.groupAside}>{aside}</Txt> : aside
          ) : null}
        </View>
      ) : null}
      <View style={styles.groupBody}>
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

/** A handful of figures side by side, no boxes. */
export function Figures({ items }: { items: { label: string; value: string | number; tone?: string }[] }) {
  return (
    <View style={styles.figures}>
      {items.map((f) => (
        <View key={f.label} style={styles.figure}>
          <Txt style={[styles.figureValue, { color: f.tone ?? colors.paper }]} numberOfLines={1} adjustsFontSizeToFit>
            {f.value}
          </Txt>
          <Txt style={styles.figureLabel}>{f.label}</Txt>
        </View>
      ))}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active ? styles.segmentActive : null]}
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

const resultColors: Record<Result, { bg: string; fg: string; label: string }> = {
  W: { bg: colors.win, fg: colors.ink, label: "Won" },
  D: { bg: colors.draw, fg: colors.ink, label: "Drew" },
  L: { bg: colors.loss, fg: colors.paper, label: "Lost" },
};

export function ResultChip({ result, size = "sm" }: { result: Result | null; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? styles.chipLg : styles.chipSm;
  const text = size === "lg" ? styles.chipTextLg : styles.chipTextSm;
  if (!result) {
    return (
      <View style={[styles.chip, dims, { backgroundColor: colors.inkLine }]} accessibilityLabel="Not finished">
        <Txt style={[text, { color: colors.mist }]}>–</Txt>
      </View>
    );
  }
  const tone = resultColors[result];
  return (
    <View style={[styles.chip, dims, { backgroundColor: tone.bg }]} accessibilityLabel={tone.label}>
      <Txt style={[text, { color: tone.fg }]}>{result}</Txt>
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
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.live} accessibilityLabel="Live">
      <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
      <Txt style={styles.liveText}>Live</Txt>
    </View>
  );
}

export function RatingMeter({ rating }: { rating: number }) {
  const pct = Math.min(Math.max(((rating - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100, 0), 100);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: RATING_MIN, max: RATING_MAX, now: rating }} accessibilityLabel="Rating">
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.draw }]} />
      </View>
      <View style={styles.meterScale}>
        <Txt style={styles.meterLabel}>{RATING_MIN.toFixed(1)}</Txt>
        <Txt style={styles.meterLabel}>{RATING_MAX.toFixed(1)}</Txt>
      </View>
    </View>
  );
}

/** Horizontal bar used for leaderboards and per-match-day totals. */
export function Bar({ value, max, tone = colors.paper }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 3) : 0;
  return (
    <View style={[styles.track, styles.trackThin]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone }]} />
    </View>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
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
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const fg = variant === "primary" ? colors.ink : variant === "danger" ? colors.loss : colors.paper;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
        pressed ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Txt style={[styles.buttonText, { color: fg }]}>{label}</Txt>
    </Pressable>
  );
}

/** Stock face for a player without an uploaded photo — the same pick the
 *  web makes (frontend/src/lib/clubData.ts stockPhoto). */
function stockPhoto(number: number) {
  return `https://i.pravatar.cc/400?img=${(number % 70) + 1}`;
}

/** The player's photo, a stock face when none was uploaded, or a silhouette
 *  if the image fails to load. */
export function Avatar({ player, size = 40, rounded = size / 2 }: { player: Player; size?: number; rounded?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = resolveMediaUrl(player.photoUrl) ?? stockPhoto(player.id);
  const box = { width: size, height: size, borderRadius: rounded };
  if (!uri || failed) {
    return (
      <View style={[styles.avatarFallback, box]} accessibilityLabel={player.name}>
        <Ionicons name="person" size={size * 0.5} color={colors.mist} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.avatarImage, box]}
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
  tabular: { fontVariant: ["tabular-nums"] } as TextStyle,
});

const styles = StyleSheet.create({
  txt: { fontFamily: fonts.body, color: colors.paper },
  screen: { flex: 1, backgroundColor: colors.ink },
  screenContent: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 48 },

  pageTitle: { marginBottom: space.lg + 4 },
  pageTitleText: { fontFamily: fonts.displayHeavy, fontSize: 40, lineHeight: 42, color: colors.paper },
  pageSub: { marginTop: 6, fontSize: 14, color: colors.mist },

  group: { marginBottom: space.xl },
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: space.sm, paddingHorizontal: 4, gap: space.md },
  groupTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.paperDim },
  groupAside: { fontSize: 12, color: colors.mist },
  groupBody: { backgroundColor: colors.inkRaised, borderRadius: radius.md, overflow: "hidden" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.inkLine },

  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowPressed: { backgroundColor: "rgba(38,47,69,0.55)" },

  figures: { flexDirection: "row", backgroundColor: colors.inkRaised, borderRadius: radius.md, paddingVertical: space.lg, paddingHorizontal: space.sm, marginBottom: space.xl },
  figure: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  figureValue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, fontVariant: ["tabular-nums"] },
  figureLabel: { marginTop: 6, fontSize: 12, color: colors.mist, textAlign: "center" },

  segmented: { flexDirection: "row", backgroundColor: colors.inkRaised, borderRadius: radius.pill, padding: 4, marginBottom: space.lg + 4 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: colors.paper },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim },
  segmentTextActive: { color: colors.ink },

  chip: { alignItems: "center", justifyContent: "center" },
  chipSm: { width: 28, height: 28, borderRadius: 8 },
  chipLg: { width: 40, height: 40, borderRadius: 12 },
  chipTextSm: { fontFamily: fonts.displayHeavy, fontSize: 15 },
  chipTextLg: { fontFamily: fonts.displayHeavy, fontSize: 21 },

  refCardSm: { width: 10, height: 14, borderRadius: 2 },
  refCardMd: { width: 13, height: 18, borderRadius: 3 },
  pips: { flexDirection: "row", alignItems: "center", gap: 6 },
  pip: { flexDirection: "row", alignItems: "center", gap: 3 },
  pipCount: { fontSize: 12, color: colors.paperDim },

  live: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(194,59,107,0.15)", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.loss },
  liveText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.loss },

  track: { height: 6, borderRadius: 3, backgroundColor: colors.inkLine, overflow: "hidden" },
  trackThin: { height: 4 },
  fill: { height: "100%", borderRadius: 3 },
  meterScale: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  meterLabel: { fontSize: 10, color: colors.mist },

  empty: { backgroundColor: colors.inkRaised, borderRadius: radius.md, paddingHorizontal: space.xl, paddingVertical: 40, alignItems: "center", marginBottom: space.xl },
  emptyText: { fontSize: 14, color: colors.paperDim, textAlign: "center", lineHeight: 20 },
  emptyAction: { marginTop: space.lg },
  loadingText: { marginTop: space.md },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: "rgba(194,59,107,0.12)", borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
  errorText: { flex: 1, fontSize: 13, color: colors.paperDim, lineHeight: 18 },
  errorRetry: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper },

  button: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, paddingHorizontal: space.xl },
  buttonPrimary: { backgroundColor: colors.paper },
  buttonSecondary: { backgroundColor: colors.inkRaised, borderWidth: 1, borderColor: colors.inkLine },
  buttonPressed: { opacity: 0.8 },
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

const badgeStyles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  text: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
