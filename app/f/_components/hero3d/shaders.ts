// 白夜の地平線 (Byakuya Horizon) — GLSL文字列群
// three.js ShaderMaterial 用。frame毎の再生成を避けるため文字列は全てモジュール定数。

export const NOISE_GLSL = /* glsl */ `
  // Ashima Arts / Stefan Gustavson simplex noise (2D, MIT)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// --- 波状地形 -----------------------------------------------------------
// 頂点: 2オクターブノイズで変位。fragmentで高さ×距離フォグで色補間。
export const WAVE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying float vHeight;
  varying float vDist;

  ${NOISE_GLSL}

  void main() {
    vec3 pos = position;
    float n1 = snoise(pos.xy * 0.09 + vec2(uTime * 0.03, uTime * 0.015));
    float n2 = snoise(pos.xy * 0.22 - vec2(uTime * 0.05, uTime * 0.02)) * 0.5;
    float height = (n1 + n2) * 0.9;
    pos.z += height;
    pos.z -= uScroll * 1.6;

    vHeight = height;
    vDist = length(pos.xy) / 14.0;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = clamp(3.0 - vDist * 2.4, 0.0, 3.0) * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// 半透明メッシュ面(地形本体)
export const WAVE_MESH_FRAGMENT = /* glsl */ `
  uniform vec3 uColorGrid;
  uniform vec3 uColorHorizon;
  varying float vHeight;
  varying float vDist;

  void main() {
    float t = clamp(vHeight * 0.6 + 0.5, 0.0, 1.0);
    vec3 color = mix(uColorGrid, uColorHorizon, t);
    float fog = clamp(1.0 - vDist * 0.85, 0.0, 1.0);
    float alpha = fog * 0.32;
    gl_FragColor = vec4(color, alpha);
  }
`;

// 輝点(データの粒)
export const WAVE_POINTS_FRAGMENT = /* glsl */ `
  uniform vec3 uColorGrid;
  uniform vec3 uColorHorizon;
  varying float vHeight;
  varying float vDist;

  void main() {
    float t = clamp(vHeight * 0.6 + 0.5, 0.0, 1.0);
    vec3 color = mix(uColorGrid, uColorHorizon, t);
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.0, d);
    float fog = clamp(1.0 - vDist * 0.9, 0.0, 1.0);
    gl_FragColor = vec4(color * 1.4, core * fog * 0.85);
  }
`;

// --- 浮遊粒子 -------------------------------------------------------------
export const PARTICLE_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute float aSpeed;
  attribute float aOffset;
  attribute float aScale;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float cycle = fract(aOffset + uTime * aSpeed * 0.02);
    pos.y += cycle * 6.0 - 3.0;
    pos.x += sin((cycle + aOffset) * 6.2831) * 0.35;
    vAlpha = sin(cycle * 3.14159265);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aScale * (220.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColorHorizon;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColorHorizon, core * vAlpha * 0.75);
  }
`;

// --- 物件カード(ガラスカード+縁発光を1枚のシェーダーに統合、1カード=1draw) ---
export const POSTER_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const POSTER_FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uGlowColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec2 edgeDist2 = min(vUv, 1.0 - vUv);
    float edgeDist = min(edgeDist2.x, edgeDist2.y);
    float edge = smoothstep(0.06, 0.0, edgeDist);
    vec3 color = tex.rgb + uGlowColor * edge * 0.9;
    float alpha = clamp(tex.a + edge * 0.5, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

// --- テーマ配色(ヒーローは常時ダーク基調。テーマ非依存の固定パレット) -----
export const THEME_PALETTE = {
  horizon: '#f9a825',
  grid: '#c75f00',
  sun: '#f7931e',
} as const;
