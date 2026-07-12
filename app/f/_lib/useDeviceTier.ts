'use client';

import { useEffect, useState } from 'react';

export type DeviceTier = 'high' | 'low';

interface NavigatorWithHints extends Navigator {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

export function decideDeviceTier(): DeviceTier {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as NavigatorWithHints;

  if (nav.connection?.saveData) return 'low';
  if ((nav.deviceMemory ?? 8) < 4) return 'low';
  if ((navigator.hardwareConcurrency ?? 8) < 4) return 'low';

  return 'high';
}

export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>('high');

  useEffect(() => {
    setTier(decideDeviceTier());
  }, []);

  return tier;
}
