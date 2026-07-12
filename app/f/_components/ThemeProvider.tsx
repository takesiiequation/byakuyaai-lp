"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";
type StoredPreference = "light" | "dark" | "system";

const STORAGE_KEY = "byakuya-theme";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.dataset.theme;
  return attr === "dark" ? "dark" : "light";
}

function readStoredPreference(): StoredPreference {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "light" || s === "dark") return s;
  } catch {
    /* ignore (private mode etc.) */
  }
  return "system";
}

function applyTheme(theme: Theme, timeoutRef: { current: number | null }) {
  const root = document.documentElement;
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
  }
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", theme);
  timeoutRef.current = window.setTimeout(() => {
    root.classList.remove("theme-switching");
    timeoutRef.current = null;
  }, 300);
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const preferenceRef = useRef<StoredPreference>("system");
  const switchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    preferenceRef.current = readStoredPreference();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (preferenceRef.current !== "system") return;
      const next: Theme = e.matches ? "dark" : "light";
      applyTheme(next, switchTimeoutRef);
      setTheme(next);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    preferenceRef.current = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore (private mode etc.) */
    }
    applyTheme(next, switchTimeoutRef);
    setTheme(next);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
