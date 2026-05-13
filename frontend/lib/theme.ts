"use client";

export type Theme = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg";
export type Language = "vi" | "en";

interface DisplayPrefs {
  theme: Theme;
  fontSize: FontSize;
  language: Language;
}

const KEY = "seo:display";
const DEFAULTS: DisplayPrefs = { theme: "system", fontSize: "md", language: "vi" };

export function getDisplayPrefs(): DisplayPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function setDisplayPrefs(prefs: Partial<DisplayPrefs>): DisplayPrefs {
  const merged = { ...getDisplayPrefs(), ...prefs };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  }
  applyDisplayPrefs(merged);
  return merged;
}

/** Apply theme + font-size to <html> as classes / CSS vars. */
export function applyDisplayPrefs(prefs: DisplayPrefs = getDisplayPrefs()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Theme
  const wantsDark =
    prefs.theme === "dark" ||
    (prefs.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", wantsDark);

  // Font size (controls Tailwind's text-base via CSS var)
  const sizeMap: Record<FontSize, string> = {
    sm: "14px",
    md: "16px",
    lg: "18px",
  };
  root.style.setProperty("--font-base", sizeMap[prefs.fontSize]);
}
