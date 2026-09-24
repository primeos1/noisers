// Brand tokens — the same palette as the web app (frontend/src/index.css).

export const colors = {
  ink: "#0a0e1a",
  inkRaised: "#131a2b",
  inkLine: "#262f45",
  paper: "#f6f6f3",
  paperDim: "#c7cbd6",
  mist: "#8a93a6",
  win: "#2f9e8a",
  draw: "#a8841f",
  loss: "#c23b6b",
} as const;

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

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 16, lg: 24, pill: 999 } as const;
