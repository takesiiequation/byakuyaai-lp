'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import WavePlane from './WavePlane';
import ParticleField from './ParticleField';
import PosterDrift from './PosterDrift';
import { THEME_PALETTE } from './shaders';

interface ByakuyaSceneProps {
  posters: string[];
  degradeLevel: 0 | 1 | 2;
  isMobile: boolean;
  showPosters: boolean;
  /** Hero3D側でDOMスクロールから毎frame更新される生の進行度(0→1) ref。React再レンダーなし */
  scrollRef: { current: number };
  /** デスクトップのみ: ポインタ視差(-1〜1) ref */
  pointerRef: { current: { x: number; y: number } };
  /** Canvasの最初のフレームが描かれたことを親へ知らせる(クロスフェード開始トリガ) */
  onFirstFrame: () => void;
}

function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ヒーローは常時ダーク基調(テーマ非依存)。ライトテーマ用パレット・useTheme・lerpは
// このシーンから完全に排除している(THEME_UI.md/ARCH.md確定事項)。
export default function ByakuyaScene({
  posters,
  degradeLevel,
  isMobile,
  showPosters,
  scrollRef,
  pointerRef,
  onFirstFrame,
}: ByakuyaSceneProps) {
  const { scene, camera } = useThree();

  const colorUniforms = useMemo(
    () => ({
      horizon: { value: new THREE.Color(THEME_PALETTE.horizon) },
      grid: { value: new THREE.Color(THEME_PALETTE.grid) },
      sun: { value: new THREE.Color(THEME_PALETTE.sun) },
    }),
    [],
  );

  // 背景はシーン側では持たない(null)。ヒーローは常時ダーク基調で、背面に常駐する
  // HeroLite/セクションのダーク背景(bg-[#0b0b0f])がそのまま透過して見える構成。
  useEffect(() => {
    scene.background = null;
    return () => {
      scene.background = null;
    };
  }, [scene]);

  const glowTexture = useMemo(() => createGlowTexture(), []);
  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  const sunMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: colorUniforms.sun.value,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [glowTexture],
  );
  useEffect(() => () => sunMaterial.dispose(), [sunMaterial]);

  const hasReportedFirstFrame = useRef(false);
  const pointerLerp = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    // ポインタ視差(デスクトップのみ、lerp 0.05)
    if (!isMobile) {
      pointerLerp.current.x = THREE.MathUtils.lerp(pointerLerp.current.x, pointerRef.current.x, 0.05);
      pointerLerp.current.y = THREE.MathUtils.lerp(pointerLerp.current.y, pointerRef.current.y, 0.05);
    } else {
      pointerLerp.current.x = 0;
      pointerLerp.current.y = 0;
    }

    const parallaxX = pointerLerp.current.x * 0.3;
    const parallaxY = pointerLerp.current.y * 0.15;
    const scrollSink = scrollRef.current * 0.8;

    camera.position.x = parallaxX;
    camera.position.y = 0.6 + parallaxY - scrollSink * 0.5;
    camera.lookAt(0, 0.2 - scrollSink * 0.6, -4);

    if (!hasReportedFirstFrame.current) {
      hasReportedFirstFrame.current = true;
      onFirstFrame();
    }
  });

  return (
    <>
      <ambientLight intensity={0.15} />

      {/* ① 白夜の太陽: 地平線に半分沈んだ発光円盤(擬似ブルーム=additive blend済CanvasTexture) */}
      <mesh position={[0, -0.7, -8]} material={sunMaterial} renderOrder={0}>
        <planeGeometry args={[7, 7]} />
      </mesh>

      {/* ② 波状地形グリッド */}
      <WavePlane
        degradeLevel={degradeLevel}
        isMobile={isMobile}
        scrollRef={scrollRef}
        colorUniforms={{ grid: colorUniforms.grid, horizon: colorUniforms.horizon }}
      />

      {/* ③ 浮遊粒子 */}
      <ParticleField
        degradeLevel={degradeLevel}
        isMobile={isMobile}
        colorUniforms={{ horizon: colorUniforms.horizon }}
      />

      {/* ④ 物件動画の漂流(その顧客の実データ、賃料等のテキストは描画しない)
          テクスチャロードはSuspenseで隔離し、波面/粒子/太陽の初フレーム描画や
          onFirstFrameをポスター読込から切り離す。読込失敗時はPosterDrift内部の
          ErrorBoundaryがポスター群のみを非表示にする(シーン全体は継続)。 */}
      {showPosters ? (
        <Suspense fallback={null}>
          <PosterDrift posters={posters} glowColor={{ value: colorUniforms.horizon.value }} />
        </Suspense>
      ) : null}
    </>
  );
}
