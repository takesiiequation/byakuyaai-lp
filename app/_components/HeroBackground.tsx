"use client";

import type { CSSProperties } from "react";

/** オーロラ背景の周期（秒）。ローカル単一の情報源として定義（外部の lib/motion には依存しない）。 */
const DUR_AURORA = 22;

type HeroBackgroundProps = {
  /** 位置調整などの追加用途のみ。既定クラスは内部で付与する。 */
  className?: string;
};

/**
 * HeroBackground — 軽量CSSオーロラ背景（装飾のみ / canvas・three不使用）
 *
 * - 2〜3枚の大径 radial-gradient ブロブを重ね、globals.css で定義された
 *   `@keyframes aurora-drift` により transform をゆっくり周回させGPU合成に載せる。
 * - reduced-motion は Tailwind の `motion-safe:` 変種でCSSレベルに一元化（静止）。
 *   静止時は初期フレーム＝美しい配置のまま。
 * - モバイル(≤640px)は blur/opacity を軽量化し、3枚目のブロブを非表示にする（DOMは同一）。
 * - アニメ周期は本ファイル内のローカル定数 DUR_AURORA を単一の情報源として参照する（値の直書き禁止）。
 */
export default function HeroBackground({ className }: HeroBackgroundProps) {
  // DUR_AURORA を起点に位相をずらした3系統の周期をCSS変数として供給（子ブロブへ継承）。
  const rootStyle = {
    "--aurora-dur-1": `${DUR_AURORA}s`,
    "--aurora-dur-2": `${DUR_AURORA + 6}s`,
    "--aurora-dur-3": `${DUR_AURORA + 12}s`,
  } as CSSProperties;

  const rootClass = [
    "absolute inset-0 -z-10 pointer-events-none overflow-hidden",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div aria-hidden="true" className={rootClass} style={rootStyle}>
      {/* ベース: brand-cream の下地（ブロブをクリームに馴染ませる） */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--brand-cream, #FBF6EE)" }}
      />

      {/* ブロブ1: warm amber #f9a825（左上・最大） */}
      <div
        className="absolute -left-[15%] -top-[20%] h-[72vw] w-[72vw] opacity-[0.45] [filter:blur(40px)] motion-safe:[animation:aurora-drift_var(--aurora-dur-1)_ease-in-out_infinite_alternate] motion-safe:[will-change:transform] sm:opacity-[0.5] sm:[filter:blur(70px)]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(249,168,37,0.55) 0%, rgba(249,168,37,0) 70%)",
        }}
      />

      {/* ブロブ2: brand orange #f7931e（右下）— 逆方向にドリフトさせ視差を作る */}
      <div
        className="absolute -bottom-[22%] -right-[15%] h-[66vw] w-[66vw] opacity-[0.4] [filter:blur(40px)] motion-safe:[animation:aurora-drift_var(--aurora-dur-2)_ease-in-out_infinite_alternate-reverse] motion-safe:[will-change:transform] sm:opacity-[0.48] sm:[filter:blur(66px)]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(247,147,30,0.5) 0%, rgba(247,147,30,0) 70%)",
        }}
      />

      {/* ブロブ3: soft coral #ff8a4c → クリームへ透過（中央右・モバイルでは非表示で軽量化） */}
      <div
        className="absolute left-[38%] top-[22%] hidden h-[56vw] w-[56vw] opacity-[0.42] [filter:blur(70px)] motion-safe:[animation:aurora-drift_var(--aurora-dur-3)_ease-in-out_infinite_alternate] motion-safe:[will-change:transform] sm:block"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,138,76,0.42) 0%, rgba(255,138,76,0) 72%)",
        }}
      />

      {/* 下端フェード: brand-cream への微グラデーションマスクで Hero コピーの可読性を担保 */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            "linear-gradient(to bottom, rgba(251,246,238,0) 0%, var(--brand-cream, #FBF6EE) 100%)",
        }}
      />
    </div>
  );
}
