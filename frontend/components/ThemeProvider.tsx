"use client";

import { useEffect } from "react";
import { applyDisplayPrefs } from "@/lib/theme";

/** Mount-only component that applies saved display prefs once and listens
 * to OS dark-mode changes when the user has picked "system". */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyDisplayPrefs();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyDisplayPrefs();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return <>{children}</>;
}
