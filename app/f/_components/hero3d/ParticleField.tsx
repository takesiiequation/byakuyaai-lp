'use client';

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_VERTEX, PARTICLE_FRAGMENT } from './shaders';

interface ParticleFieldProps {
  /** 1以上でパーティクル数を50%に(drawRange縮小のみ、attribute再生成なし) */
  degradeLevel: 0 | 1 | 2;
  isMobile: boolean;
  colorUniforms: {
    horizon: { value: THREE.Color };
  };
}

const MAX_DESKTOP = 1200;
const MAX_MOBILE = 500;

export default function ParticleField({ degradeLevel, isMobile, colorUniforms }: ParticleFieldProps) {
  const maxCount = isMobile ? MAX_MOBILE : MAX_DESKTOP;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxCount * 3);
    const speeds = new Float32Array(maxCount);
    const offsets = new Float32Array(maxCount);
    const scales = new Float32Array(maxCount);

    for (let i = 0; i < maxCount; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
      speeds[i] = 0.4 + Math.random() * 1.1;
      offsets[i] = Math.random();
      scales[i] = 0.5 + Math.random() * 1.5;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    return geo;
  }, [maxCount]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const uTime = useMemo(() => ({ value: 0 }), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime,
          uColorHorizon: colorUniforms.horizon,
        },
        vertexShader: PARTICLE_VERTEX,
        fragmentShader: PARTICLE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uTime],
  );
  useEffect(() => () => material.dispose(), [material]);

  // drawRange 縮小のみで attribute/uniform 再生成なし(降格コスト最小)
  const drawCount = degradeLevel >= 1 ? Math.round(maxCount * 0.5) : maxCount;

  useFrame((_, delta) => {
    uTime.value += delta;
    geometry.setDrawRange(0, drawCount);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
