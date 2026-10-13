"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";

const KEY = "theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = {
  system: "Theme follows your device",
  light: "Light theme",
  dark: "Dark theme",
};

// Runs in <head> before first paint, so a forced theme never flashes the other
// one. "system" is stored as no attribute at all and the CSS media query decides.
export const themeScript = `(function(){try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function apply(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as const);

  // React's dev-mode remount resets <html> attributes; put the choice back.
  useLayoutEffect(() => apply(read()), []);

  function next() {
    const chosen = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    try {
      if (chosen === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, chosen);
    } catch {
      // Storage blocked: the switch still works for this page view.
    }
    apply(chosen);
    listeners.forEach((l) => l());
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={next}
      aria-label={`${LABEL[theme]}. Tap to change.`}
      title={LABEL[theme]}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-ring"
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
