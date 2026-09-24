import type { ColorValue } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useClub } from "../../lib/club";
import { colors, fonts } from "../../theme";

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size} color={color as string} />;
}

export default function TabsLayout() {
  const { events } = useClub();
  const live = events.filter((e) => e.status === "live").length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.paper,
        tabBarInactiveTintColor: colors.mist,
        tabBarStyle: { backgroundColor: colors.ink, borderTopColor: colors.inkLine },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Squad", tabBarIcon: tabIcon("shirt-outline") }} />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: tabIcon("time-outline"),
          tabBarBadge: live ? "Live" : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.loss, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="stats" options={{ title: "Stats", tabBarIcon: tabIcon("stats-chart-outline") }} />
      <Tabs.Screen name="club" options={{ title: "Club", tabBarIcon: tabIcon("shield-half-outline") }} />
    </Tabs>
  );
}
