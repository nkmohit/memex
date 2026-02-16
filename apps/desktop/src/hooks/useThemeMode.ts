import { useEffect, useState } from "react";

const THEME_KEY = "memex-theme";

export type ThemeMode = "light" | "dark" | "system";

function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "light") {
    root.classList.remove("dark");
    return;
  }
  if (mode === "dark") {
    root.classList.add("dark");
    return;
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (theme !== "system") return;
      applyThemeClass("system");
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [theme]);

  function setThemeAndPersist(next: ThemeMode) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  return { theme, setThemeAndPersist };
}

