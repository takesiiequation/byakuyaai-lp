"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useReducedMotion } from "../_lib/useReducedMotion";

/**
 * Full-bleed background for /portal/login: a 6-clip rotation, ordered as
 * one day's arc (dawn → noon → dusk → rain → blue hour → night → dawn…),
 * crossfaded with a hand-rolled requestAnimationFrame loop — the
 * "FadingVideo" recipe (rescue-doc §3 upper form), extended from a single
 * self-looping clip to a rotation across six clips.
 *
 * Rules ported from the recipe, applied per-clip:
 *  - no `loop` attribute — playback end is handled manually.
 *  - fade is driven by rAF against direct DOM opacity, never a CSS
 *    transition, so it can resume mid-fade from whatever opacity it's
 *    currently at (robust to being retriggered).
 *  - the previous rAF id for a given element is always cancelled before a
 *    new fade starts on that same element.
 *  - near the end of a clip: fade the *current* clip to 0. On `ended`:
 *    snap opacity to 0, pause, wait ENDED_RESET_DELAY_MS, then advance the
 *    rotation — the clip that was already preloading in the background
 *    (see below) becomes current, seeks to 0, plays, and fades to 1.
 *
 * Bandwidth: only two <video> elements are ever mounted — the currently
 * playing one and the *next* one in the rotation (preload="auto" so the
 * browser buffers it ahead of time). The third clip isn't mounted at all
 * until it becomes "next".
 */

type MediaItem = { src: string; poster: string };

const MEDIA: readonly MediaItem[] = [
  { src: "/portal-media/login-dawn.mp4", poster: "/portal-media/login-dawn-poster.webp" },
  { src: "/portal-media/login-noon.mp4", poster: "/portal-media/login-noon-poster.webp" },
  { src: "/portal-media/login-dusk.mp4", poster: "/portal-media/login-dusk-poster.webp" },
  { src: "/portal-media/login-rain.mp4", poster: "/portal-media/login-rain-poster.webp" },
  { src: "/portal-media/login-bluehour.mp4", poster: "/portal-media/login-bluehour-poster.webp" },
  { src: "/portal-media/login-night.mp4", poster: "/portal-media/login-night-poster.webp" },
];

const FADE_MS = 800;
// Start fading the current clip out once this many seconds remain. Scaled
// up from the recipe's FADE_MS=500/trigger=0.55s pairing; kept slightly
// above the old ratio ("0.55s強") since our fade is now longer than the
// remaining budget — the tail of the fade-out is simply cut short (and
// snapped to 0) by the `ended` handler, which is fine visually.
const FADE_TRIGGER_REMAINING_S = 0.6;
const ENDED_RESET_DELAY_MS = 100;

export default function LoginBackdrop() {
  const reducedMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const [rotation, setRotation] = useState(0);

  const currentIdx = rotation % MEDIA.length;
  const nextIdx = (rotation + 1) % MEDIA.length;

  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const opacityRef = useRef<Map<number, number>>(new Map());
  const fadeRafRef = useRef<Map<number, number>>(new Map());
  const fadeOutStartedRef = useRef<Set<number>>(new Set());
  const endedTimeoutRef = useRef<number | null>(null);

  const cancelFade = useCallback((idx: number) => {
    const id = fadeRafRef.current.get(idx);
    if (id !== undefined) {
      cancelAnimationFrame(id);
      fadeRafRef.current.delete(idx);
    }
  }, []);

  const fadeTo = useCallback(
    (idx: number, target: number, durationMs: number) => {
      const el = videoRefs.current.get(idx);
      if (!el) return;
      cancelFade(idx); // 前のrAF idをcancelしてから開始
      const start = opacityRef.current.get(idx) ?? parseFloat(el.style.opacity || "0");
      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const value = start + (target - start) * t;
        el.style.opacity = String(value);
        opacityRef.current.set(idx, value);
        if (t < 1) {
          fadeRafRef.current.set(idx, requestAnimationFrame(step));
        } else {
          fadeRafRef.current.delete(idx);
        }
      };
      fadeRafRef.current.set(idx, requestAnimationFrame(step));
    },
    [cancelFade]
  );

  const registerRef = useCallback(
    (idx: number) => (node: HTMLVideoElement | null) => {
      if (node) videoRefs.current.set(idx, node);
      else videoRefs.current.delete(idx);
    },
    []
  );

  const handleTimeUpdate = useCallback(
    (idx: number) => (e: SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      if (!el.duration || Number.isNaN(el.duration)) return;
      const remaining = el.duration - el.currentTime;
      if (remaining <= FADE_TRIGGER_REMAINING_S && !fadeOutStartedRef.current.has(idx)) {
        fadeOutStartedRef.current.add(idx);
        fadeTo(idx, 0, FADE_MS);
      }
    },
    [fadeTo]
  );

  const handleEnded = useCallback(
    (idx: number) => () => {
      cancelFade(idx);
      const el = videoRefs.current.get(idx);
      if (el) {
        el.style.opacity = "0";
        opacityRef.current.set(idx, 0);
        el.pause();
      }
      if (endedTimeoutRef.current !== null) window.clearTimeout(endedTimeoutRef.current);
      endedTimeoutRef.current = window.setTimeout(() => {
        setRotation((r) => r + 1);
      }, ENDED_RESET_DELAY_MS);
    },
    [cancelFade]
  );

  const handleError = useCallback(() => {
    setVideoFailed(true);
  }, []);

  // Whenever the "current" role moves to a new clip (mount, or after a
  // rotation advance), reset+play it and fade it in. The element itself
  // was already mounted (and preloading) in the previous render as
  // "next", so no remount happens here — just a role change.
  useEffect(() => {
    const el = videoRefs.current.get(currentIdx);
    if (!el) return;
    fadeOutStartedRef.current.delete(currentIdx);
    try {
      el.currentTime = 0;
    } catch {
      // some browsers throw if metadata isn't ready yet — harmless
    }
    const playPromise = el.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => setVideoFailed(true));
    }
    fadeTo(currentIdx, 1, FADE_MS);
    // fadeTo is stable (useCallback), only currentIdx should retrigger this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  useEffect(() => {
    return () => {
      fadeRafRef.current.forEach((id) => cancelAnimationFrame(id));
      fadeRafRef.current.clear();
      if (endedTimeoutRef.current !== null) window.clearTimeout(endedTimeoutRef.current);
    };
  }, []);

  if (reducedMotion || videoFailed) {
    return (
      <div
        className="absolute inset-0 z-0 bg-[#0b0b0f] bg-cover bg-center"
        style={{ backgroundImage: `url(${MEDIA[0].poster})` }}
        aria-hidden="true"
      />
    );
  }

  const visible = [currentIdx, nextIdx];

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#0b0b0f]" aria-hidden="true">
      {MEDIA.map((item, idx) => {
        if (!visible.includes(idx)) return null;
        return (
          <video
            key={idx}
            ref={registerRef(idx)}
            src={item.src}
            poster={item.poster}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover pointer-events-none"
            style={{ opacity: opacityRef.current.get(idx) ?? 0 }}
            onTimeUpdate={handleTimeUpdate(idx)}
            onEnded={handleEnded(idx)}
            onError={handleError}
          />
        );
      })}
    </div>
  );
}
