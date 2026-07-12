'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomerData } from '../_data/types';
import type { ViewProperty } from '../_lib/viewModel';
import { useReducedMotion } from '../_lib/useReducedMotion';
import FeedCard from './FeedCard';

interface FeedViewProps {
  properties: ViewProperty[];
  customer: CustomerData;
  initialIndex?: number;
  onBack: () => void;
  onOpenCompliance: () => void;
  keyboardDisabled?: boolean;
}

export default function FeedView({
  properties,
  customer,
  initialIndex = 0,
  onBack,
  onOpenCompliance,
  keyboardDisabled = false,
}: FeedViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideElementsRef = useRef<Map<number, HTMLElement>>(new Map());
  const slideRefCallbacksRef = useRef<Map<number, (element: HTMLElement | null) => void>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const activeIndexRef = useRef(0);
  const hasJumpedRef = useRef(false);

  const clampedInitialIndex =
    properties.length === 0 ? 0 : Math.min(Math.max(initialIndex, 0), properties.length - 1);

  const [activeIndex, setActiveIndex] = useState(clampedInitialIndex);
  const [pageVisible, setPageVisible] = useState(true);
  const reducedMotion = useReducedMotion();

  // activeIndexRefはactiveIndexの変化にuseEffect経由で同期させる(直接代入しない)
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // タブの表示状態をstateに反映する(直接pauseはFeedCard側のisActive経由のeffectに任せる)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    const target = slideElementsRef.current.get(index);
    if (!container || !target) return;
    container.scrollTo({ top: target.offsetTop, behavior });
  }, []);

  // 初回マウント時のみ、initialIndexへアニメーション無しでジャンプする
  useEffect(() => {
    if (hasJumpedRef.current || properties.length === 0) return;
    hasJumpedRef.current = true;
    if (clampedInitialIndex > 0) {
      scrollToIndex(clampedInitialIndex, 'auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 単一のIntersectionObserverで画面内に入っているスライドだけをplay対象(activeIndex)にする
  useEffect(() => {
    const container = containerRef.current;
    if (!container || properties.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIndex = activeIndexRef.current;
        let bestRatio = 0;

        for (const entry of entries) {
          const indexAttr = (entry.target as HTMLElement).dataset.index;
          if (indexAttr === undefined) continue;
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIndex = Number(indexAttr);
          }
        }

        if (bestRatio > 0) {
          setActiveIndex(bestIndex);
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    observerRef.current = observer;
    slideElementsRef.current.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [properties.length]);

  // 上下矢印キーでの手動送り
  useEffect(() => {
    if (properties.length === 0 || keyboardDisabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        scrollToIndex(Math.min(activeIndexRef.current + 1, properties.length - 1), reducedMotion ? 'auto' : 'smooth');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        scrollToIndex(Math.max(activeIndexRef.current - 1, 0), reducedMotion ? 'auto' : 'smooth');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [properties.length, scrollToIndex, keyboardDisabled, reducedMotion]);

  const getSlideRefCallback = useCallback((index: number) => {
    const existingCallback = slideRefCallbacksRef.current.get(index);
    if (existingCallback) return existingCallback;

    const callback = (element: HTMLElement | null) => {
      if (element) {
        slideElementsRef.current.set(index, element);
        observerRef.current?.observe(element);
      } else {
        const existingElement = slideElementsRef.current.get(index);
        if (existingElement) {
          observerRef.current?.unobserve(existingElement);
        }
        slideElementsRef.current.delete(index);
      }
    };

    slideRefCallbacksRef.current.set(index, callback);
    return callback;
  }, []);

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/70"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      <span aria-hidden="true">←</span>
      一覧に戻る
    </button>
  );

  if (properties.length === 0) {
    return (
      <div className="relative flex h-dvh w-full items-center justify-center bg-black px-6 text-center text-white">
        {backButton}
        現在公開中の物件動画がありません。
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full bg-black">
      {backButton}

      <div
        ref={containerRef}
        className="h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain"
      >
        {properties.map((property, index) => (
          <section
            key={property.id}
            ref={getSlideRefCallback(index)}
            data-index={index}
            className="relative h-dvh w-full snap-start snap-always"
          >
            <FeedCard
              property={property}
              customer={customer}
              isActive={index === activeIndex && pageVisible}
              reducedMotion={reducedMotion}
              onOpenCompliance={onOpenCompliance}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
