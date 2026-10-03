import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useExecutives } from "../lib/content";
import { resolveMediaUrl } from "../lib/config";
import type { Executive, ExecutiveGroup } from "../lib/types";
import { Empty, ErrorBanner, PageTitle, Screen, Txt, text } from "../components/ui";
import { CoverFlow, Glass, Reveal, Skeleton, Tilt } from "../components/depth";
import { colors, fonts, radius, shadow, space } from "../theme";

// The people who run the club (frontend/src/pages/Executives.tsx): the
// executives, the backroom staff and the disciplinary panel.

const SECTIONS: { id: ExecutiveGroup; heading: string; blurb: string; accent: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "executive", heading: "The Executives", blurb: "The committee that steers the club — every decision, every season.", accent: colors.win, icon: "ribbon" },
  { id: "staff", heading: "The Backroom", blurb: "Kit, pitch, cameras and everything that keeps matchday moving.", accent: colors.paper, icon: "construct" },
  { id: "disciplinary", heading: "The Panel", blurb: "Fair play, firm hand — they hear every case and settle every fine.", accent: colors.justice, icon: "scale" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Portrait({ exec, width, height = width * 1.3, accent }: { exec: Executive; width: number; height?: number; accent: string }) {
  const uri = resolveMediaUrl(exec.photo);
  return (
    <View style={[styles.portrait, { width, height }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient colors={[`${accent}55`, colors.inkRaised]} style={[StyleSheet.absoluteFill, styles.initialsBox]}>
          <Txt style={[styles.initials, { color: accent }]}>{initials(exec.name)}</Txt>
        </LinearGradient>
      )}
      <LinearGradient colors={["transparent", "rgba(10,14,26,0.95)"]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.portraitText}>
        <Txt style={[styles.title, { color: accent }]} numberOfLines={1}>
          {exec.title}
        </Txt>
        <Txt style={styles.name} numberOfLines={2}>
          {exec.name}
        </Txt>
      </View>
    </View>
  );
}

export default function ExecutivesScreen() {
  const { executives, loading, error, reload } = useExecutives();
  const { width } = useWindowDimensions();
  const sorted = [...executives].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const president = sorted.find((e) => e.group === "executive" && /president/i.test(e.title)) ?? sorted.find((e) => e.group === "executive");

  return (
    <Screen onRefresh={reload} topInset="header">
      <Reveal>
        <PageTitle eyebrow="Who runs Noisers" title="The club" />
      </Reveal>
      <ErrorBanner message={error} onRetry={reload} />

      {loading ? (
        <Skeleton style={styles.heroSkeleton} />
      ) : sorted.length === 0 ? (
        <Empty icon="people-outline">{"The committee hasn't added anyone yet."}</Empty>
      ) : (
        <>
          {president ? (
            <Reveal>
              <View style={[styles.hero, shadow.glow(colors.gold)]}>
                <Portrait exec={president} width={width - space.lg * 2} height={Math.min((width - space.lg * 2) * 1.05, 440)} accent={colors.goldBright} />
                <View style={styles.crown}>
                  <Ionicons name="star" size={12} color={colors.ink} />
                  <Txt style={styles.crownText}>{president.title}</Txt>
                </View>
              </View>
            </Reveal>
          ) : null}

          {SECTIONS.map((section, si) => {
            const people = sorted.filter((e) => e.group === section.id && e.id !== president?.id);
            if (people.length === 0) return null;
            return (
              <Reveal key={section.id} index={si + 1}>
                <Glass style={styles.sectionHead}>
                  <LinearGradient colors={[`${section.accent}30`, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <Ionicons name={section.icon} size={22} color={section.accent} />
                  <View style={styles.flex}>
                    <Txt style={styles.sectionHeading}>{section.heading}</Txt>
                    <Txt style={text.small}>{section.blurb}</Txt>
                  </View>
                </Glass>
                <CoverFlow
                  data={people}
                  itemWidth={190}
                  keyOf={(e) => e.id}
                  renderItem={(e) => (
                    <Tilt accessibilityRole="none" accessibilityLabel={`${e.name}, ${e.title}`}>
                      <Portrait exec={e} width={190} accent={section.accent} />
                    </Tilt>
                  )}
                />
              </Reveal>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  heroSkeleton: { height: 420, borderRadius: radius.xl },
  hero: { borderRadius: radius.xl, marginBottom: space.xl },
  crown: { position: "absolute", top: space.lg, left: space.lg, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.goldBright, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  crownText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: colors.ink },
  portrait: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.inkRaised, ...shadow.card },
  initialsBox: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: fonts.displayHeavy, fontSize: 64 },
  portraitText: { position: "absolute", left: space.lg, right: space.lg, bottom: space.lg },
  title: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  name: { fontFamily: fonts.displayHeavy, fontSize: 30, lineHeight: 30, color: colors.paper, textTransform: "uppercase", marginTop: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, marginTop: space.md },
  sectionHeading: { fontFamily: fonts.display, fontSize: 24, color: colors.paper },
});
