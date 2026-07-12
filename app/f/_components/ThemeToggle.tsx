"use client";

import { useEffect, useState } from "react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span
        className="inline-block h-11 w-11 shrink-0"
        aria-hidden="true"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="テーマ切替"
      className="group inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-[var(--ring-w)] focus-visible:outline-offset-[var(--ring-offset)] focus-visible:outline-[var(--ring)]"
    >
      <span
        aria-hidden="true"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[var(--border-1)] bg-[var(--surface-2)] text-base leading-none text-[var(--text-1)] transition-colors group-hover:border-[var(--text-3)]"
      >
        {isDark ? "☾" : "☀️"}
      </span>
    </button>
  );
}
