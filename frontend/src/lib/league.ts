import navyKit from "../assets/kits/navy.jpg";
import whiteKit from "../assets/kits/white.jpg";
import yellowKit from "../assets/kits/yellow.jpg";
import blackKit from "../assets/kits/black.jpg";
import stripesKit from "../assets/kits/stripes.jpg";
import greenKit from "../assets/kits/green.jpg";

export type ClubId = "bulwark" | "citadel" | "islanders" | "sentinel" | "castellers" | "coastal";

export interface Club {
  id: ClubId;
  name: string;
  /** Three letters for tight rows and crests. */
  short: string;
  kit: string;
  motto: string;
  /** One line on what the name stands for. */
  story: string;
  /** The home kit as worn in the club names reveal. */
  strip: { shirt: string; shorts: string; socks: string };
  /** Shirt, trim, glow; `on` is the text colour that reads on the shirt. */
  colours: { primary: string; secondary: string; glow: string; on: string; stripe?: string; shorts: string; socks: string };
  image: string;
}

/** The six squads, in the order of "How we chose our club names" (8 Oct 2026). */
export const clubs: Club[] = [
  {
    id: "bulwark",
    name: "Bulwark FC",
    short: "BUL",
    kit: "Navy",
    motto: "The wall that holds.",
    story: "A bulwark is the solid wall that stands firm so everyone behind it is protected.",
    strip: { shirt: "Navy, white trim", shorts: "Navy", socks: "White, navy tops" },
    colours: { primary: "#1d2547", secondary: "#efece4", glow: "#4a63b8", on: "#f6f6f3", shorts: "#1d2547", socks: "#efece4" },
    image: navyKit,
  },
  {
    id: "citadel",
    name: "Citadel FC",
    short: "CIT",
    kit: "White",
    motto: "The last stronghold.",
    story: "A citadel is the fortified heart of a city, the point that must hold when everything else is under pressure.",
    strip: { shirt: "White, navy trim", shorts: "White", socks: "White, navy hoops" },
    colours: { primary: "#eeeeea", secondary: "#1d2a4d", glow: "#b9c6e6", on: "#0a0e1a", shorts: "#eeeeea", socks: "#eeeeea" },
    image: whiteKit,
  },
  {
    id: "islanders",
    name: "Islanders United",
    short: "ISL",
    kit: "Yellow",
    motto: "Stronger together, wherever we stand.",
    story: "Islanders depend on one another, and 'United' is the football word for a team that wins as one.",
    strip: { shirt: "Yellow, black trim", shorts: "Black", socks: "Yellow, black tops" },
    colours: { primary: "#f2b41c", secondary: "#121212", glow: "#f2b41c", on: "#0a0e1a", shorts: "#121212", socks: "#f2b41c" },
    image: yellowKit,
  },
  {
    id: "sentinel",
    name: "Sentinel FC",
    short: "SEN",
    kit: "Black",
    motto: "Always on watch.",
    story: "A sentinel is the guard who keeps watch while others rest, and never lets the guard down.",
    strip: { shirt: "Black, gold trim", shorts: "Gold", socks: "Black, gold tops" },
    colours: { primary: "#141416", secondary: "#f0ad1e", glow: "#f0ad1e", on: "#f0ad1e", shorts: "#f0ad1e", socks: "#141416" },
    image: blackKit,
  },
  {
    id: "castellers",
    name: "Castellers United",
    short: "CAS",
    kit: "Blue and red stripes",
    motto: "Built from the base up.",
    story: "Castellers build Catalonia's human towers, which stand only when a strong base carries everyone above.",
    strip: { shirt: "Red and blue stripes", shorts: "Blue", socks: "Blue, red tops" },
    colours: { primary: "#a01d3a", secondary: "#e9b53b", glow: "#3a5bd1", on: "#e9b53b", stripe: "#1f3c94", shorts: "#1f3c94", socks: "#1f3c94" },
    image: stripesKit,
  },
  {
    id: "coastal",
    name: "Coastal City FC",
    short: "CCF",
    kit: "Green",
    motto: "A nod to Lagos, Nigeria.",
    story: "A proud nod to Lagos, Nigeria's great Atlantic city, without naming it.",
    strip: { shirt: "Green, white trim", shorts: "Green", socks: "Green, white tops" },
    colours: { primary: "#1d6a3a", secondary: "#f3f1ea", glow: "#2fa35f", on: "#f6f6f3", shorts: "#1d6a3a", socks: "#1d6a3a" },
    image: greenKit,
  },
];
