'use client';

import { useEffect, useState } from 'react';
import type { CustomerData } from '../_data/types';
import ThemeToggle from './ThemeToggle';

interface AdaptiveHeaderProps {
  customer: CustomerData;
  /** Pushes the fixed header down (used only by /f/demo, which renders a
   * fixed compliance banner above it — see PortfolioView.tsx). Undefined for
   * every real /f/[slug] client page, so this has zero effect there. */
  style?: React.CSSProperties;
}

const TOP_SENTINEL_ID = 'ah-sentinel-top';
const BOUNDARY_SENTINEL_ID = 'ah-sentinel-boundary';

export default function AdaptiveHeader({ customer, style }: AdaptiveHeaderProps) {
  const [transparent, setTransparent] = useState(true);

  useEffect(() => {
    const topEl = document.getElementById(TOP_SENTINEL_ID);
    const boundaryEl = document.getElementById(BOUNDARY_SENTINEL_ID);
    if (!topEl || !boundaryEl) return;

    let topVisible = true;
    // boundaryPassed: ヒーロー下端センチネルが固定ヘッダー境界線(64px)を
    // 上へ通過済みかどうか。isIntersectingは「まだ到達していない」場合と
    // 「通過して画面外に抜けた」場合の両方でfalseになり区別できないため、
    // boundingClientRect.topの実位置で判定する（往復スクロールにも追従）。
    let boundaryPassed = false;
    const update = () => setTransparent(topVisible || !boundaryPassed);

    const topObserver = new IntersectionObserver(
      ([entry]) => {
        topVisible = entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    const boundaryObserver = new IntersectionObserver(
      ([entry]) => {
        boundaryPassed = entry.boundingClientRect.top < 64;
        update();
      },
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' },
    );

    topObserver.observe(topEl);
    boundaryObserver.observe(boundaryEl);

    return () => {
      topObserver.disconnect();
      boundaryObserver.disconnect();
    };
  }, []);

  return (
    <header
      style={style}
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        transparent
          ? 'border-b border-transparent bg-transparent'
          : 'border-b border-[var(--border-1)] bg-[var(--surface-header)] backdrop-blur'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <img
          src={customer.logoUrl}
          alt={`${customer.company}のロゴ`}
          className={`h-10 w-10 flex-shrink-0 rounded-full border object-cover sm:h-12 sm:w-12 ${
            transparent ? 'border-white/40' : 'border-[var(--border-1)]'
          }`}
        />
        <div className="min-w-0">
          <p
            className={`truncate text-base font-bold leading-tight transition-colors duration-300 sm:text-lg ${
              transparent ? 'text-white' : 'text-[var(--text-1)]'
            }`}
          >
            {customer.company}
          </p>
          <p
            className={`truncate text-xs transition-colors duration-300 sm:text-sm ${
              transparent ? 'text-white/80' : 'text-[var(--text-2)]'
            }`}
          >
            {customer.catchCopy}
          </p>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
