"use client";

import { useEffect, useState } from "react";

// Portal-local copy of app/f/_lib/useReducedMotion.ts — duplicated rather
// than imported so the /f section (and its own release cadence) stays
// untouched by portal work, matching the precedent set by
// app/portal/_components/Shell.tsx (see its header comment).
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
    setPrefersReducedMotion(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);
    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
