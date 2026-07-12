'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../_lib/useReducedMotion';

interface LikeButtonProps {
  propertyId: string;
  size?: 'sm' | 'md';
}

// いいねバースト: 6粒を60度おきに放射させる一回性パーティクル
const BURST_ANGLES = [0, 60, 120, 180, 240, 300];
const BURST_DISTANCE = 20;

const STORAGE_PREFIX = 'byakuyaai:like:';

function readLiked(propertyId: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + propertyId) === '1';
  } catch {
    return false;
  }
}

function writeLiked(propertyId: string, liked: boolean): void {
  try {
    if (liked) {
      window.localStorage.setItem(STORAGE_PREFIX + propertyId, '1');
    } else {
      window.localStorage.removeItem(STORAGE_PREFIX + propertyId);
    }
  } catch {
    // localStorageが使用できない環境(プライベートモード等)では何もしない
  }
}

export default function LikeButton({ propertyId, size = 'md' }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [burstActive, setBurstActive] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setLiked(readLiked(propertyId));
  }, [propertyId]);

  const iconSize = size === 'sm' ? 20 : 26;
  const boxSize = size === 'sm' ? 40 : 52;
  const count = liked ? 1 : 0;

  const handleClick = () => {
    const next = !liked;
    setLiked(next);
    writeLiked(propertyId, next);
    if (next) {
      setPulseKey((current) => current + 1);
      if (!reducedMotion) {
        setBurstActive(true);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? 'いいねを取り消す' : 'いいねする'}
      style={{ width: boxSize, height: boxSize }}
      className="relative flex flex-col items-center justify-center gap-1 text-white"
    >
      {burstActive && !reducedMotion ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {BURST_ANGLES.map((angle, index) => {
            const radians = (angle * Math.PI) / 180;
            return (
              <motion.span
                key={`${pulseKey}-${angle}`}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{ width: 4, height: 4, marginLeft: -2, marginTop: -2, backgroundColor: 'var(--brand-orange)' }}
                initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                animate={{
                  opacity: 0,
                  x: Math.cos(radians) * BURST_DISTANCE,
                  y: Math.sin(radians) * BURST_DISTANCE,
                  scale: 0.4,
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                onAnimationComplete={index === 0 ? () => setBurstActive(false) : undefined}
              />
            );
          })}
        </span>
      ) : null}

      <motion.svg
        key={pulseKey}
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={liked ? 'var(--brand-orange)' : 'none'}
        stroke={liked ? 'var(--brand-orange)' : '#ffffff'}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.65))' }}
        initial={false}
        animate={liked ? { scale: [1, 1.5, 0.9, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        whileTap={{ scale: 0.85 }}
      >
        <path d="M12 21s-7.5-4.6-10-9.3C0.4 8.4 2 4.5 5.6 4c2-.3 3.7.7 5 2.4C11.9 4.7 13.6 3.7 15.6 4c3.6.5 5.2 4.4 3.6 7.7C19.5 16.4 12 21 12 21z" />
      </motion.svg>
      <span className="text-xs font-semibold tabular-nums" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
        {count}
      </span>
    </button>
  );
}
