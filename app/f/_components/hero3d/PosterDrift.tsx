'use client';

import { Component, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { POSTER_VERTEX, POSTER_FRAGMENT } from './shaders';

interface PosterDriftProps {
  /** getActiveProperties() 済み配列の先頭最大4件のposterUrl。成約物件はそもそも到達不能。 */
  posters: string[];
  /** 降格レベル2でポスターカードを非表示にする(親でunmount) */
  glowColor: { value: THREE.Color };
}

const CARD_W = 0.9;
const CARD_H = 1.6;
// draw call予算のためポスターは最大4枚(太陽1+波面2+粒子1+ポスター4=8)
const MAX_POSTERS = 4;

// ポスターのテクスチャ読込に失敗した場合、このErrorBoundaryがポスター群のみを
// 非表示にする(シーン全体やonFallbackには伝播させない = コンプラ表示は常に生存)。
class PosterErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // 意図的に握りつぶす: ポスター群のみ非表示にし、Hero3D全体のフォールバックは呼ばない。
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function PosterDriftScene({ posters, glowColor }: PosterDriftProps) {
  const list = useMemo(() => posters.slice(0, MAX_POSTERS).filter(Boolean), [posters]);
  const textures = useTexture(list);
  const orbitRef = useRef<THREE.Group>(null);

  const texArray = useMemo(() => (Array.isArray(textures) ? textures : [textures]), [textures]);

  useEffect(() => {
    texArray.forEach((tex) => {
      if (!tex) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 1;
      tex.needsUpdate = true;
    });
  }, [texArray]);

  const materials = useMemo(
    () =>
      texArray.map(
        (tex) =>
          new THREE.ShaderMaterial({
            uniforms: {
              uMap: { value: tex },
              uGlowColor: glowColor,
              uOpacity: { value: 0.9 },
            },
            vertexShader: POSTER_VERTEX,
            fragmentShader: POSTER_FRAGMENT,
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    // glowColor は ByakuyaScene 側で安定した ref なので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [texArray],
  );

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose());
    },
    [materials],
  );

  const layout = useMemo(
    () =>
      list.map((_, index) => {
        const angle = (index / Math.max(list.length, 1)) * Math.PI * 2;
        const radius = 4.4 + (index % 2) * 0.6;
        return {
          angle,
          radius,
          y: -0.6 + Math.sin(angle * 1.7) * 0.5,
          speed: 0.5 + (index % 3) * 0.15,
        };
      }),
    [list],
  );

  useFrame((_, delta) => {
    if (orbitRef.current) {
      // 「ゆっくり周回」— 1周 約6分相当のゆっくりした自転
      orbitRef.current.rotation.y += delta * 0.017;
    }
  });

  if (list.length === 0) return null;

  return (
    <group ref={orbitRef} position={[0, -0.4, -1.5]}>
      {layout.map((item, index) => {
        const x = Math.cos(item.angle) * item.radius;
        const z = Math.sin(item.angle) * item.radius - 3;
        return (
          <Float
            key={list[index]}
            rotationIntensity={0.2}
            floatIntensity={0.6}
            speed={item.speed}
          >
            <group position={[x, item.y, z]} rotation={[0, -item.angle, 0]}>
              {/* 9:16 ガラスカード(縁の発光はシェーダー内に統合、1カード=1draw、
                  賃料等のテキストは描画しない) */}
              <mesh material={materials[index]}>
                <planeGeometry args={[CARD_W, CARD_H]} />
              </mesh>
            </group>
          </Float>
        );
      })}
    </group>
  );
}

export default function PosterDrift(props: PosterDriftProps) {
  return (
    <PosterErrorBoundary>
      <PosterDriftScene {...props} />
    </PosterErrorBoundary>
  );
}
