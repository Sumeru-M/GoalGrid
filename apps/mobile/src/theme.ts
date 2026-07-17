import { Platform, useColorScheme } from "react-native";

/**
 * Monochrome design system for React Native — the port of the web app's CSS
 * tokens (styles.css). Solid black & white, no accent hue; light/dark inverts
 * via the OS; corner radii adapt per platform (iOS rounder, Android tighter).
 */
export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  cardFeatured: string;   // inverted "featured" surface
  inkFeatured: string;
  stroke: string;
  strokeStrong: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;         // pure ink — solid fills for buttons/active
  onAccent: string;
  danger: string;
  priority: [string, string, string, string, string]; // P1..P5 grayscale ramp
  radius: number;
  radiusSm: number;
  radiusPill: number;
  titleWeight: "700" | "600";
}

const dark = {
  dark: true,
  bg: "#000000",
  card: "#141414",
  cardFeatured: "#ffffff",
  inkFeatured: "#000000",
  stroke: "#2a2a2a",
  strokeStrong: "#3a3a3a",
  text: "#ffffff",
  muted: "#a0a0a0",
  faint: "#6a6a6a",
  accent: "#ffffff",
  onAccent: "#000000",
  danger: "#ff453a",
  priority: ["#ffffff", "#cfcfcf", "#9a9a9a", "#6a6a6a", "#3f3f3f"] as [string, string, string, string, string],
};

const light = {
  dark: false,
  bg: "#ffffff",
  card: "#ffffff",
  cardFeatured: "#000000",
  inkFeatured: "#ffffff",
  stroke: "#e6e6e8",
  strokeStrong: "#d4d4d6",
  text: "#000000",
  muted: "#6a6a6e",
  faint: "#9a9a9e",
  accent: "#000000",
  onAccent: "#ffffff",
  danger: "#ff3b30",
  priority: ["#000000", "#444444", "#777777", "#a6a6a6", "#cfcfcf"] as [string, string, string, string, string],
};

// Platform conventions (iOS rounder / heavier titles; Android tighter / Material).
const platformTokens = {
  radius: Platform.select({ ios: 20, android: 16, default: 20 }),
  radiusSm: Platform.select({ ios: 14, android: 12, default: 14 }),
  radiusPill: 999,
  titleWeight: Platform.select<"700" | "600">({ ios: "700", android: "600", default: "700" }),
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const base = scheme === "light" ? light : dark;
  return { ...base, ...platformTokens } as Theme;
}

/** Priority colour for a level (1..5) in the current theme. */
export function priorityColor(theme: Theme, level: number): string {
  return theme.priority[Math.min(5, Math.max(1, level)) - 1];
}

/** Numeric priority label (P1..P5) — numbers, not qualitative words. */
export function priorityLabel(level: number): string {
  return `P${Math.min(5, Math.max(1, level))}`;
}
