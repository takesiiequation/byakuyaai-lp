'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WAVE_VERTEX, WAVE_MESH_FRAGMENT, WAVE_POINTS_FRAGMENT } from './shaders';

interface WavePlaneProps {
  /** 0: フル品質 / 1: dpr降格後もセグメントは維持 / 2: drawRangeで描画量を半減 */
  degradeLevel: 0 | 1 | 2;
  isMobile: boolean;
  /** 0(hero先頭)→1(離脱)の生スクロール進行度を毎frame読むための ref */
  scrollRef: { current: number };
  colorUniforms: {
    grid: { value: THREE.Color };
    horizon: { value: THREE.Color };
  };
}

export default function WavePlane({ degradeLevel, isMobile, scrollRef, colorUniforms }: WavePlaneProps) {
  // ジオメトリは最大セグメントで1度だけ生成する(isMobileでのみ再生成)。
  // 降格はdrawRangeの縮小のみで表現し、PlaneGeometryの再生成/破棄を毎degrade変化で
  // 発生させない(GPUリソースの生成・破棄churnを避ける)。
  const baseSegW = isMobile ? 64 : 96;
  const baseSegH = isMobile ? 40 : 64;

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(24, 16, baseSegW, baseSegH);
    geo.rotateX(-Math.PI / 2.35);
    return geo;
  }, [baseSegW, baseSegH]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uTime = useMemo(() => ({ value: 0 }), []);
  const uScroll = useMemo(() => ({ value: 0 }), []);

  const meshMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime,
          uScroll,
          uColorGrid: colorUniforms.grid,
          uColorHorizon: colorUniforms.horizon,
        },
        vertexShader: WAVE_VERTEX,
        fragmentShader: WAVE_MESH_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    // colorUniforms への参照は安定(ByakuyaSceneでuseMemo生成)なので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uTime, uScroll],
  );
  useEffect(() => () => meshMaterial.dispose(), [meshMaterial]);

  const pointsMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime,
          uScroll,
          uColorGrid: colorUniforms.grid,
          uColorHorizon: colorUniforms.horizon,
        },
        vertexShader: WAVE_VERTEX,
        fragmentShader: WAVE_POINTS_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uTime, uScroll],
  );
  useEffect(() => () => pointsMaterial.dispose(), [pointsMaterial]);

  const groupRef = useRef<THREE.Group>(null);

  // フル解像度のindex数。degradeLevel>=2ではこの半分(三角形単位=3の倍数に丸め)だけ
  // drawRangeで描画する。ジオメトリ自体は再生成しない。
  const fullIndexCount = geometry.index ? geometry.index.count : 0;

  useFrame((_, delta) => {
    uTime.value += delta;
    uScroll.value = THREE.MathUtils.lerp(uScroll.value, scrollRef.current, 0.08);

    const drawCount =
      degradeLevel >= 2 && fullIndexCount > 0
        ? Math.max(3, Math.floor(fullIndexCount / 2 / 3) * 3)
        : fullIndexCount;
    if (geometry.drawRange.count !== drawCount) {
      geometry.setDrawRange(0, drawCount);
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.4, -2]}>
      <mesh geometry={geometry} material={meshMaterial} renderOrder={0} />
      <points geometry={geometry} material={pointsMaterial} renderOrder={1} />
    </group>
  );
}
