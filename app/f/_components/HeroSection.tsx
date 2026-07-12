'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform } from 'framer-motion';
import HeroLite from './HeroLite';
import { useHeroTier } from '../_lib/useHeroTier';
import type { CustomerData } from '../_data/types';
import type { ViewProperty } from '../_lib/viewModel';

interface Hero3DProps {
  posters: string[];
  onReady: () => void;
  onFallback: () => void;
}

const Hero3D = dynamic<Hero3DProps>(() => import('./Hero3D'), {
  ssr: false,
});

interface HeroSectionProps {
  customer: CustomerData;
  properties: ViewProperty[];
}

export default function HeroSection({ customer, properties }: HeroSectionProps) {
  const heroRef = useRef<HTMLElement>(null);
  const tier = useHeroTier();
  const [hero3dReady, setHero3dReady] = useState(false);
  const [hero3dFallback, setHero3dFallback] = useState(false);

  const handleReady = useCallback(() => {
    setHero3dReady(true);
  }, []);

  const handleFallback = useCallback(() => {
    setHero3dReady(false);
    setHero3dFallback(true);
    try {
      sessionStorage.setItem('heroTier', 'lite');
    } catch {
      /* ignore (private mode etc.) */
    }
  }, []);

  const posters = useMemo(
    () => properties.slice(0, 4).map((property) => property.posterUrl).filter(Boolean),
    [properties],
  );

  const showHero3d = tier === '3d' && !hero3dFallback;

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const exitOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);
  const exitY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const exitScale = useTransform(scrollYProgress, [0, 1], [1, 0.97]);

  return (
    <section
      ref={heroRef}
      className="relative isolate flex h-[100svh] min-h-[560px] w-full flex-col overflow-hidden bg-[#0b0b0f] text-[#f5f0e8]"
      style={{ colorScheme: 'dark' }}
    >
      <motion.div
        className="relative z-0 flex-1"
        style={{ opacity: exitOpacity, y: exitY, scale: exitScale }}
      >
        <HeroLite customer={customer} activeCount={properties.length} />

        {showHero3d ? (
          <Suspense fallback={null}>
            <motion.div
              aria-hidden={!hero3dReady}
              className="pointer-events-none absolute inset-0 z-[1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: hero3dReady ? 1 : 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <Hero3D posters={posters} onReady={handleReady} onFallback={handleFallback} />
            </motion.div>
          </Suspense>
        ) : null}
      </motion.div>

      {/* boundary bleed toward the themed surface below (item3) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[20svh]"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--surface))' }}
      />

      <a
        href="#properties"
        className="hero-scroll-cue absolute inset-x-0 bottom-16 z-10 mx-auto flex w-fit flex-col items-center gap-1 text-xs font-medium tracking-wide text-[#f5f0e8]/80 transition hover:text-[#f5f0e8]"
      >
        <span>物件を見る</span>
        <span className="hero-scroll-cue-chevron text-base leading-none">↓</span>
      </a>

      <style>{`
        @keyframes hero-scroll-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        .hero-scroll-cue-chevron {
          display: inline-block;
          animation: hero-scroll-bounce 1.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-scroll-cue-chevron {
            animation: none;
          }
          html {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </section>
  );
}
