import { Reveal } from "@/app/_components/Motion";

// Dark-basis hero for /f pages (v4 integration plan §コンプラ・安全: "ヒーローは
// 常時ダーク基調 — ライトパレットを足さない=過去事故"). This is a lightweight
// CSS-gradient hero (reuses globals.css's existing `aurora-drift` keyframe,
// dark-tinted) — NOT the three.js Hero3D/ByakuyaScene the v4 UI package
// specifies (that package was not found on this machine; see the front-f
// handoff note in app/f/_lib/sanitizeForPortfolio.ts and the final report).
export function Hero({
  clientName,
  tagline,
}: {
  clientName: string;
  tagline?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-neutral-950 px-4 py-20 sm:px-6 sm:py-28">
      <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -left-[10%] -top-[20%] h-[60vw] w-[60vw] opacity-40 [filter:blur(70px)] motion-safe:[animation:aurora-drift_26s_ease-in-out_infinite_alternate]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(247,147,30,0.55) 0%, rgba(247,147,30,0) 70%)",
          }}
        />
        <div
          className="absolute -bottom-[25%] -right-[10%] h-[55vw] w-[55vw] opacity-30 [filter:blur(80px)] motion-safe:[animation:aurora-drift_32s_ease-in-out_infinite_alternate-reverse]"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,138,76,0.4) 0%, rgba(255,138,76,0) 72%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-5xl text-center">
        <Reveal immediate>
          <p className="text-xs font-semibold tracking-[0.2em] text-[var(--brand-orange-light)]">
            PORTFOLIO
          </p>
        </Reveal>
        <Reveal immediate delay={0.05}>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-4xl">
            {clientName}
          </h1>
        </Reveal>
        {tagline && (
          <Reveal immediate delay={0.1}>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
              {tagline}
            </p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
