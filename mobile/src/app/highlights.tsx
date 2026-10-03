import { useState } from "react";
import { FlatList, Modal, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HIGHLIGHT_CATEGORIES, useHighlights } from "../lib/content";
import { resolveMediaUrl } from "../lib/config";
import type { Highlight, HighlightCategory } from "../lib/types";
import { Chips, Empty, ErrorBanner, PageTitle, Screen, Txt, text } from "../components/ui";
import { Reveal, Skeleton, Tilt } from "../components/depth";
import { colors, fonts, radius, shadow, space } from "../theme";

// The public gallery (frontend/src/pages/Highlights.tsx): a two-column
// masonry of photos and clips. Photos open in a swipeable full-screen
// viewer; clips open in the in-app browser.

type Filter = "All" | HighlightCategory;

function Tile({ h, width, onOpen }: { h: Highlight; width: number; onOpen: () => void }) {
  const uri = resolveMediaUrl(h.src) ?? undefined;
  const video = h.type === "video";
  return (
    <Tilt onPress={onOpen} accessibilityLabel={`${video ? "Video" : "Photo"}: ${h.caption || h.alt || h.category}`} max={7}>
      <View style={[styles.tile, { width, height: h.tall ? width * 1.5 : width }]}>
        {video ? (
          <LinearGradient colors={["#1b2440", colors.inkDeep]} style={StyleSheet.absoluteFill} />
        ) : (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={uri} />
        )}
        {video ? (
          <View style={styles.play}>
            <Ionicons name="play" size={26} color={colors.ink} />
          </View>
        ) : null}
        <LinearGradient colors={["transparent", "rgba(10,14,26,0.92)"]} style={styles.shade} />
        <View style={styles.tileText}>
          <Txt style={styles.category}>{h.category}</Txt>
          {h.caption ? (
            <Txt style={styles.caption} numberOfLines={2}>
              {h.caption}
            </Txt>
          ) : null}
        </View>
      </View>
    </Tilt>
  );
}

function Viewer({ photos, index, onClose }: { photos: Highlight[]; index: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index);
  const shown = photos[current];
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.viewer}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(h) => String(h.id)}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Image source={{ uri: resolveMediaUrl(item.src) ?? undefined }} style={{ width, height }} contentFit="contain" accessibilityLabel={item.alt ?? item.caption ?? "Photo"} />
          )}
        />
        <LinearGradient colors={["rgba(0,0,0,0.6)", "transparent"]} style={[styles.viewerTop, { paddingTop: insets.top + space.sm }]}>
          <Txt style={text.small}>
            {current + 1} of {photos.length}
          </Txt>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.paper} />
          </Pressable>
        </LinearGradient>
        {shown?.caption ? (
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={[styles.viewerBottom, { paddingBottom: insets.bottom + space.lg }]}>
            <Txt style={styles.viewerCaption}>{shown.caption}</Txt>
            <Txt style={text.small}>{[shown.category, shown.date].filter(Boolean).join(" · ")}</Txt>
          </LinearGradient>
        ) : null}
      </View>
    </Modal>
  );
}

export default function HighlightsScreen() {
  const { highlights, loading, error, reload } = useHighlights();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>("All");
  const [open, setOpen] = useState<number | null>(null);

  const visible = highlights.filter((h) => filter === "All" || h.category === filter);
  const photos = visible.filter((h) => h.type === "photo");
  const col = Math.floor((width - space.lg * 2 - space.md) / 2);

  // Masonry: drop each tile into whichever column is shorter.
  const columns: Highlight[][] = [[], []];
  const heights = [0, 0];
  for (const h of visible) {
    const c = heights[0] <= heights[1] ? 0 : 1;
    columns[c].push(h);
    heights[c] += h.tall ? 1.5 : 1;
  }

  function openTile(h: Highlight) {
    if (h.type === "video") {
      const url = resolveMediaUrl(h.src);
      if (url) WebBrowser.openBrowserAsync(url).catch(() => undefined);
      return;
    }
    setOpen(photos.findIndex((p) => p.id === h.id));
  }

  return (
    <Screen onRefresh={reload} topInset="header">
      <Reveal>
        <PageTitle eyebrow="Goals, saves & skills" title="Highlights" />
      </Reveal>
      <ErrorBanner message={error} onRetry={reload} />
      <Chips<Filter> value={filter} onChange={setFilter} options={(["All", ...HIGHLIGHT_CATEGORIES] as Filter[]).map((c) => ({ value: c, label: c }))} />

      {loading ? (
        <View style={styles.grid}>
          <View style={styles.column}>
            <Skeleton style={{ height: col * 1.5 }} />
            <Skeleton style={{ height: col }} />
          </View>
          <View style={styles.column}>
            <Skeleton style={{ height: col }} />
            <Skeleton style={{ height: col * 1.5 }} />
          </View>
        </View>
      ) : visible.length === 0 ? (
        <Empty icon="images-outline">{filter === "All" ? "No highlights yet." : `Nothing in ${filter} yet.`}</Empty>
      ) : (
        <View style={styles.grid}>
          {columns.map((list, c) => (
            <View key={c} style={styles.column}>
              {list.map((h, i) => (
                <Reveal key={h.id} index={i * 2 + c}>
                  <Tile h={h} width={col} onOpen={() => openTile(h)} />
                </Reveal>
              ))}
            </View>
          ))}
        </View>
      )}

      {open !== null && open >= 0 ? <Viewer photos={photos} index={open} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: space.md },
  column: { flex: 1, gap: space.md },
  tile: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.inkRaised, ...shadow.card },
  shade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
  tileText: { position: "absolute", left: space.md, right: space.md, bottom: space.md },
  category: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: colors.goldBright },
  caption: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paper, marginTop: 2 },
  play: { position: "absolute", top: "50%", left: "50%", width: 54, height: 54, marginLeft: -27, marginTop: -40, borderRadius: 27, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", paddingLeft: 3 },

  viewer: { flex: 1, backgroundColor: "#000" },
  viewerTop: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, paddingBottom: space.xl },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  viewerBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.xxl, gap: 4 },
  viewerCaption: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.paper },
});
