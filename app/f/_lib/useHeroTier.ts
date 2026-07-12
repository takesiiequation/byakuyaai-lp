'use client';

import { useEffect, useState } from 'react';
import { decideDeviceTier } from './useDeviceTier';

export type HeroTier = 'pending' | 'lite' | '3d';

const SESSION_KEY = 'heroTier';

function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

function decideHeroTier(): 'lite' | '3d' {
  if (typeof window === 'undefined') return 'lite';
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'lite';
  if (decideDeviceTier() === 'low') return 'lite';
  if (!supportsWebgl()) return 'lite';
  return '3d';
}

function readStoredTier(): 'lite' | '3d' | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === 'lite' || stored === '3d') return stored;
  } catch {
    /* ignore (private mode etc.) */
  }
  return null;
}

function writeStoredTier(tier: 'lite' | '3d') {
  try {
    sessionStorage.setItem(SESSION_KEY, tier);
  } catch {
    /* ignore (private mode etc.) */
  }
}

export function useHeroTier(): HeroTier {
  const [tier, setTier] = useState<HeroTier>('pending');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const resolve = () => {
      if (cancelled) return;
      const stored = readStoredTier();
      if (stored === 'lite') {
        // 'lite'方向のキャッシュは完全信頼(再検証不要)
        setTier(stored);
        return;
      }
      if (stored === '3d') {
        // '3d'キャッシュはreduced-motion有効化等の変化があり得るため再検証する
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (reducedMotion || decideDeviceTier() === 'low' || !supportsWebgl()) {
          writeStoredTier('lite');
          setTier('lite');
          return;
        }
        setTier('3d');
        return;
      }
      const decided = decideHeroTier();
      writeStoredTier(decided);
      setTier(decided);
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(resolve);
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }

    const timeoutId = window.setTimeout(resolve, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      writeStoredTier('lite');
      setTier('lite');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  return tier;
}
