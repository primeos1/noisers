import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "../../components/TabBar";
import { useClub } from "../../lib/club";

// A custom floating glass tab bar (components/TabBar.tsx), drawn the same on
// iOS and Android so it matches the rest of the app's depth layer.

export default function TabsLayout() {
  const { events } = useClub();
  const live = events.some((e) => e.status === "live");

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} live={live} />}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="squad" options={{ title: "Squad" }} />
      <Tabs.Screen name="matches" options={{ title: "Matches" }} />
      <Tabs.Screen name="stats" options={{ title: "Stats" }} />
      <Tabs.Screen name="club" options={{ title: "Club" }} />
    </Tabs>
  );
}
