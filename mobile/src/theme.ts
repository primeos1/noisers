// Brand tokens — the same palette as the web app (frontend/src/index.css),
// plus the depth layer the app adds on top: floodlight glows, glass
// surfaces, the gold trim used on award and player cards, and shadows.

export const colors = {
  ink: "#0a0e1a",
  inkDeep: "#05070f",
  inkRaised: "#131a2b",
  inkLine: "#262f45",
  paper: "#f6f6f3",
  paperDim: "#c7cbd6",
  mist: "#8a93a6",
  win: "#2f9e8a",
  draw: "#a8841f",
  loss: "#c23b6b",
  justice: "#d8b56a",
  travel: "#5b9bd5",
  gold: "#d4a93a",
  goldBright: "#f2d27a",
} as const;

/** Translucent layers that sit over the floodlit backdrop. */
export const glass = {
  /** Grouped lists and cards. */
  surface: "rgba(23,30,50,0.72)",
  /** Raised elements on top of a surface (chips, inputs inside cards). */
  raised: "rgba(255,255,255,0.06)",
  /** Hairline edge that catches the light along the top of a surface. */
  edge: "rgba(255,255,255,0.09)",
  edgeBright: "rgba(255,255,255,0.18)",
  pressed: "rgba(255,255,255,0.07)",
} as const;

/** Top-lit sheen laid over glass and cards (LinearGradient colours). */
export const sheen = ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.0)"] as const;

/** Gold foil for awards, "your shirt" and top ratings. */
export const foil = ["#f7e3a1", "#d4a93a", "#8c6a2c", "#e9c86f"] as const;

// Big Shoulders Display for headlines and numerals, Inter for body/UI.
// Names match the keys loaded by useFonts in src/app/_layout.tsx.
export const fonts = {
  display: "BigShouldersDisplay_700Bold",
  displayHeavy: "BigShouldersDisplay_900Black",
  displaySemi: "BigShouldersDisplay_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 16, lg: 24, xl: 32, pill: 999 } as const;

/** Elevation for floating cards — iOS shadow plus Android elevation. */
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  }),
} as const;

/** Shared spring for presses and tilts, so every surface moves alike. */
export const springs = {
  press: { damping: 15, stiffness: 260, mass: 0.6 },
  settle: { damping: 18, stiffness: 140 },
} as const;
