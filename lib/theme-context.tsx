"use client";

// Minimal ThemeProvider + useTheme implementation using native ESM React.
// Replaces next-themes in the rendering path to avoid next-themes' CJS
// require("react") which resolves to null in Turbopack's static-generation
// worker, causing "null (reading 'useContext')" build failures.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "system" | "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme";
const MQ = "(prefers-color-scheme: dark)";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia(MQ).matches ? "dark" : "light";
}

function resolveTheme(t: Theme, systemTheme: "light" | "dark"): "light" | "dark" {
  return t === "system" ? systemTheme : t;
}

function readStoredTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system";
  } catch {
    return "system";
  }
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const sys = getSystemTheme();
    setSystemTheme(sys);
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(resolveTheme(stored, sys));

    const mq = window.matchMedia(MQ);
    const handleMq = (e: MediaQueryListEvent) => {
      const newSys = e.matches ? "dark" : "light";
      setSystemTheme(newSys);
      if (readStoredTheme() === "system") applyTheme(newSys);
    };
    mq.addEventListener("change", handleMq);

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const newTheme = (e.newValue as Theme) ?? "system";
      setThemeState(newTheme);
      applyTheme(resolveTheme(newTheme, getSystemTheme()));
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      mq.removeEventListener("change", handleMq);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    applyTheme(resolveTheme(t, getSystemTheme()));
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme: resolveTheme(theme, systemTheme),
      systemTheme,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, systemTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const fallback: ThemeContextValue = {
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "dark",
  systemTheme: "dark",
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? fallback;
}
