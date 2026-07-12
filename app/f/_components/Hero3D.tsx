'use client';

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor, Preload } from '@react-three/drei';
import { useScroll } from 'framer-motion';
import ByakuyaScene from './hero3d/ByakuyaScene';

interface Hero3DProps {
  /** getActiveProperties() 済みの先頭最大4枚。9:16ガラスカードとして地平線上を漂流。 */
  posters: string[];
  /** 初フレーム描画後に呼ばれる(親がHeroLiteとの600msクロスフェードを開始) */
  onReady: () => void;
  /** 3段階降格の最終段。呼ばれたらこのコンポーネントは自ら描画を止める(親はLiteに確定) */
  onFallback: () => void;
}

type DegradeLevel = 0 | 1 | 2;

// Canvas全体を包むフェイルセーフ。3Dシーン内で予期せぬ例外(WebGLコンテキスト
// ロスト等)が起きても、ポスターや免許番号等のコンプラ表示を含むページ全体を
// 巻き込んでクラッシュさせず、親のonFallback経由でHeroLiteへ確定させる。
class Hero3DErrorBoundary extends Component<
  { onFallback: () => void; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onFallback: () => void; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onFallback();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function Hero3D({ posters, onReady, onFallback }: Hero3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [degradeLevel, setDegradeLevel] = useState<DegradeLevel>(0);
  const [fallenBack, setFallenBack] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);

  const scrollRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  // --- デバイス幅(セグメント/パーティクル数の基準。performance tierとは独立) ---
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // --- スクロール進行度をrefへ(R3F側の再レンダーを起こさない) ---
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (value) => {
      scrollRef.current = value;
    });
    return unsubscribe;
  }, [scrollYProgress]);

  // --- デスクトップのみポインタ視差 ---
  useEffect(() => {
    if (isMobile) return;
    const handlePointerMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      pointerRef.current = { x: nx, y: ny };
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [isMobile]);

  // --- ヒーローがビューポート外なら frameloop 停止(下部閲覧中のGPU消費ゼロ) ---
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleDecline = useCallback(() => {
    setDegradeLevel((level) => (level >= 2 ? 2 : ((level + 1) as DegradeLevel)));
  }, []);

  const handleHardFallback = useCallback(() => {
    setFallenBack(true);
    onFallback();
  }, [onFallback]);

  const handleFirstFrame = useCallback(() => {
    onReady();
  }, [onReady]);

  if (fallenBack) return null;

  const dpr: [number, number] = degradeLevel >= 1 ? [1, 1.25] : [1, 1.75];
  const showPosters = degradeLevel < 2 && posters.filter(Boolean).length > 0;

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      <Hero3DErrorBoundary onFallback={handleHardFallback}>
        <Canvas
          dpr={dpr}
          gl={{
            antialias: false,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          frameloop={heroVisible ? 'always' : 'never'}
          camera={{ fov: 50, position: [0, 0.6, 6] }}
        >
          <PerformanceMonitor bounds={() => [45, 59]} flipflops={3} onDecline={handleDecline} onFallback={handleHardFallback} />
          <AdaptiveDpr pixelated={false} />
          <ByakuyaScene
            posters={posters}
            degradeLevel={degradeLevel}
            isMobile={isMobile}
            showPosters={showPosters}
            scrollRef={scrollRef}
            pointerRef={pointerRef}
            onFirstFrame={handleFirstFrame}
          />
          <Preload all />
        </Canvas>
      </Hero3DErrorBoundary>
    </div>
  );
}
