"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

const CYCLE: Array<"system" | "light" | "dark"> = ["system", "light", "dark"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoid hydration mismatch — only show icon after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function cycle() {
    const current = (theme ?? "system") as "system" | "light" | "dark";
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  }

  const Icon = !mounted
    ? Monitor
    : theme === "light"
    ? Sun
    : theme === "dark"
    ? Moon
    : Monitor;

  const label = !mounted ? "System" : theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      onClick={cycle}
      aria-label={`Current theme: ${label}. Click to cycle.`}
      title={`Theme: ${label}`}
      className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
    >
      <Icon size={16} />
    </button>
  );
}
