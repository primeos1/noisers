import { useCallback, useEffect, useState } from "react";
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  BigShouldersDisplay_600SemiBold,
  BigShouldersDisplay_700Bold,
  BigShouldersDisplay_900Black,
} from "@expo-google-fonts/big-shoulders-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "../lib/auth";
import { ClubProvider, useClub } from "../lib/club";
import { AnimatedSplash, SplashDoneProvider } from "../components/AnimatedSplash";
import { colors, fonts } from "../theme";

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.paper,
    background: colors.ink,
    card: colors.ink,
    text: colors.paper,
    border: colors.inkLine,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BigShouldersDisplay_600SemiBold,
    BigShouldersDisplay_700Bold,
    BigShouldersDisplay_900Black,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Carry on with system fonts if the font files fail, rather than hang on the splash.
  const fontsReady = loaded || !!error;
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // The animated loading screen's first frame matches the native splash, so
  // hand over as soon as it can draw (it needs the fonts).
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <ClubProvider>
          <StatusBar style="light" />
          <SplashDoneProvider done={splashDone}>
            <RootNavigator />
          </SplashDoneProvider>
          {splashDone ? null : <SplashGate onDone={finishSplash} />}
        </ClubProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Holds the loading screen until the session is restored and, for anyone
 *  already let in, the first load of club data has landed. */
function SplashGate({ onDone }: { onDone: () => void }) {
  const { status, hasAccess } = useAuth();
  const { loading } = useClub();
  const ready = status !== "restoring" && (!hasAccess || !loading);
  return <AnimatedSplash ready={ready} onDone={onDone} />;
}

function RootNavigator() {
  const { status, hasAccess } = useAuth();

  if (status === "restoring") return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.paper,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.ink },
      }}
    >
      {/* Squad passcode or committee sign-in, as on the web portal. */}
      <Stack.Protected guard={hasAccess}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ title: "" }} />
        <Stack.Screen name="match/[id]" options={{ title: "Match sheet" }} />
        <Stack.Protected guard={status === "signedIn"}>
          {/* Committee tools — the same sections as the web admin. */}
          <Stack.Screen name="admin/matchday" options={{ title: "Match Day" }} />
          <Stack.Screen name="admin/squad" options={{ title: "Squad" }} />
          <Stack.Screen name="admin/player" options={{ title: "Player", presentation: "modal" }} />
          <Stack.Screen name="admin/matches" options={{ title: "Matches" }} />
          <Stack.Screen name="admin/cards" options={{ title: "Cards & fines" }} />
          <Stack.Screen name="admin/new-card" options={{ title: "Log a card", presentation: "modal" }} />
          <Stack.Screen name="admin/reports" options={{ title: "Reports" }} />
          <Stack.Screen name="admin/home-content" options={{ title: "Home page" }} />
          <Stack.Screen name="admin/vale" options={{ title: "The Vale" }} />
          <Stack.Screen name="admin/highlights" options={{ title: "Highlights" }} />
          <Stack.Screen name="admin/settings" options={{ title: "Settings" }} />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Protected guard={!hasAccess}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
