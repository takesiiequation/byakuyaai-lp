import Image from "next/image";
import { faqs } from "./_data/faqs";
import { JsonLd } from "./_components/JsonLd";
import { PlanSwitcher } from "./_components/PlanSwitcher";
import { Reveal, RevealStagger, RevealItem, CountUp, TiltCard } from "./_components/Motion";
import HeroBackground from "./_components/HeroBackground";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <JsonLd />
      <SiteHeader />
      <Hero />
      <PlanSwitcher />
      <FlowSection />
      <WorksSection />
      <PricingSection />
      <FaqSection />
      <ContactSection />
      <SiteFooter />
    </main>
  );
}

/* ============================================================
 * Site Header (sticky)
 * ============================================================ */
function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="ByakuyaAI"
            width={140}
            height={42}
            priority
            className="h-9 w-auto"
          />
          <span className="hidden text-sm font-bold text-[var(--brand-ink)] sm:inline-block">
            不動産集客をAIで自動化
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs font-bold tracking-wider text-[var(--brand-gray)] md:inline-block">
            AIは、眠らない。
          </span>
          <a
            href="#contact"
            className="inline-flex items-center rounded-full bg-[var(--brand-orange)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--brand-orange-dark)] sm:text-sm"
          >
             無料お試しパック
            <span className="ml-1">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
 * Hero (First View)
 * ============================================================ */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[var(--brand-cream)] via-white to-[var(--brand-cream-2)]">
      <HeroBackground />
      {/* Left accent bar — brand consistency with A4 proposal */}
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:py-24">
        {/* Left: Copy */}
        <RevealStagger className="flex flex-col justify-center">
          <RevealItem className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--brand-orange)] bg-white px-4 py-1.5 text-xs font-bold tracking-wider text-[var(--brand-orange-dark)]">
            <span className="text-[var(--brand-orange)]">✓</span>
            賃貸
            <span className="text-[var(--brand-orange)]">✓</span>
            売買 どちらにも対応
          </RevealItem>

          <RevealItem as="h1" className="text-[2.25rem] font-black leading-[1.2] tracking-tight text-[var(--brand-ink)] sm:text-5xl lg:text-[3.5rem]">
            写真とマイソクを
            <br className="sm:hidden" />
            送るだけ。
            <br />
            あとは
            <span className="relative mx-1 inline-block text-[var(--brand-orange)]">
              AI
              <span className="absolute inset-x-0 -bottom-1 h-1 rounded-full bg-[var(--brand-orange)]/80"></span>
            </span>
            が
            <br className="sm:hidden" />
            全部やります。
          </RevealItem>

          <RevealItem as="p" className="mt-6 text-base leading-relaxed text-[var(--brand-gray)] sm:text-lg">
            プロ品質のショート動画をAIが自動で生成し、
            <br className="hidden sm:block" />
            SNSへの投稿まで実行。撮影も編集も要りません。
          </RevealItem>

          <RevealItem className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-orange)] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-200 transition hover:translate-y-[-1px] hover:bg-[var(--brand-orange-dark)] hover:shadow-xl"
            >
               無料お試しパック
              <span className="ml-2 text-lg">→</span>
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-orange)] bg-white px-7 py-3 text-base font-bold text-[var(--brand-orange-dark)] transition hover:bg-[var(--brand-cream)]"
            >
              料金プランを見る
            </a>
          </RevealItem>

          <RevealItem as="p" className="mt-4 text-xs text-[var(--brand-gray-light)]">
            契約期間の縛りなし／いつでも解約OK
          </RevealItem>
        </RevealStagger>

        {/* Right: Instagram-on-iPhone sample video frame */}
        <Reveal className="flex items-center justify-center">
          <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-[2.5rem] border-[6px] border-[var(--brand-ink)] bg-white shadow-2xl sm:max-w-[320px] animate-float-y">
            {/* Phone notch */}
            <div className="absolute left-1/2 top-0 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-[var(--brand-ink)]" />

            {/* Instagram app frame */}
            <div className="flex h-full w-full flex-col bg-white">
              {/* Top spacing under notch */}
              <div className="h-7 flex-shrink-0" />

              {/* Instagram post header */}
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 p-[1.5px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[10px] font-black text-[var(--brand-ink)]">
                    B
                  </div>
                </div>
                <div className="flex-1 leading-tight">
                  <p className="text-[11px] font-semibold text-[var(--brand-ink)]">
                    byakuyaai
                  </p>
                  <p className="text-[9px] text-gray-500">白金台 / 賃貸</p>
                </div>
                <svg
                  className="h-4 w-4 text-gray-700"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </div>

              {/* 1:1 Video */}
              <div className="relative aspect-square w-full flex-shrink-0 bg-black">
                <video
                  src="/hero-sample.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Action icons row */}
              <div className="flex flex-shrink-0 items-center gap-3 px-3 pb-1.5 pt-2 text-[var(--brand-ink)]">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                <svg
                  className="ml-auto h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>

              {/* Caption (property listing style, compact) */}
              <div className="flex-shrink-0 px-3 pb-1 pt-0.5">
                <p className="text-[10px] leading-snug text-[var(--brand-ink)]">
                  <span className="font-semibold">byakuyaai</span>{" "}
                  <span className="text-gray-700">
                    白金台駅 徒歩10分 ・ 2LDK 168㎡ ・ ¥3,500,000/月
                  </span>
                </p>
                <p className="mt-0.5 text-[9px] text-gray-500">
                  大理石ペントハウス × サウナ #白金台 #高級賃貸
                </p>
              </div>

              {/* Spacer to push bottom nav up from rounded corner */}
              <div className="flex-1 min-h-[8px]" />

              {/* Instagram bottom navigation (compact, with safe bottom padding) */}
              <div className="flex flex-shrink-0 items-center justify-around border-t border-gray-100 px-3 pb-3 pt-1.5">
                {/* Home */}
                <svg
                  className="h-4 w-4 text-[var(--brand-ink)]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 3l-9 8h2v9h5v-6h4v6h5v-9h2z" />
                </svg>
                {/* Search */}
                <svg
                  className="h-4 w-4 text-gray-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {/* Reels */}
                <svg
                  className="h-4 w-4 text-gray-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <polygon points="10 9 16 12 10 15" fill="currentColor" />
                </svg>
                {/* Shop */}
                <svg
                  className="h-4 w-4 text-gray-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                {/* Profile */}
                <div className="h-4 w-4 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 p-[1.5px]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[6px] font-black text-[var(--brand-ink)]">
                    B
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}


/* ============================================================
 * Works Section (制作事例) — 2026-08-05
 * 実際の納品動画(顧客名は「貴社名」に匿名化・掲載は事後報告方針)。
 * 営業文面からの着地先も兼ねる(id="works")。動画は preload="none" で
 * LCPに影響させない。免責はComplianceFooterの流儀を踏襲。
 * ============================================================ */
function WorksSection() {
  return (
    <section id="works" className="relative bg-[var(--brand-cream)] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <Reveal>
          <p className="text-center text-xs font-bold tracking-[0.25em] text-[var(--brand-orange-dark)]">
            WORKS
          </p>
          <h2 className="mt-3 text-center text-2xl font-bold text-[var(--brand-ink)] sm:text-3xl">
            制作事例 — AI が作った&quot;実物&quot;をご覧ください
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-[var(--brand-gray)]">
            実際にお客様へ納品した動画です(お客様名の部分のみ「貴社名」に差し替えています)。
            お客様がスマホで撮影した写真・動画とマイソクから、ナレーション・テロップ・BGM・効果音まで全自動で仕上がっています。
          </p>
        </Reveal>
        <Reveal>
          <div className="mx-auto mt-10 w-full max-w-[300px]">
            <div className="overflow-hidden rounded-[2rem] border-[6px] border-[var(--brand-ink)] bg-black shadow-2xl shadow-black/20">
              <video
                src="/works/sample-tour.mp4"
                poster="/works/sample-tour-poster.jpg"
                controls
                playsInline
                preload="none"
                className="block h-auto w-full"
              />
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--brand-gray-light)]">
              ※ 物件情報は制作時点のものです。現況と異なる場合があります。
              <br />
              ※ 照明・時間帯の演出はイメージです。
            </p>
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-8 text-center text-sm font-semibold text-[var(--brand-ink)]">
            投稿文(キャプション)とハッシュタグも、動画と同時に AI が自動作成します
          </p>
        </Reveal>
      </div>
    </section>
  );
}


/* ============================================================
 * Flow Section (導入の流れ)
 * ============================================================ */
function FlowSection() {
  const steps = [
    {
      num: "01",
      title: "写真を撮影",
      desc: "空室・外観・周辺をスマホで撮影するだけ。プロカメラマン不要、特別な機材も不要です。",
      detail: "推奨: 1物件あたり10〜20枚",
    },
    {
      num: "02",
      title: "フォームで送信",
      desc: "専用フォームにマイソクと写真をアップロード。間取りや家賃はマイソクから AI が自動で読み取ります。",
      detail: "所要時間: 約3分",
    },
    {
      num: "03",
      title: "AI が動画を生成",
      desc: "台本・ナレーション・BGM・テロップまで AI が自動制作。映像と言葉が一致した動画に仕上げます。",
      detail: "生成時間: 約15〜30分",
    },
    {
      num: "04",
      title: "SNS に自動投稿",
      desc: "Instagram・TikTok に最適な時間帯で自動投稿。ハッシュタグも AI が最適化。",
      detail: "手動投稿も可能",
    },
  ];

  return (
    <section id="flow" className="relative bg-white py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
              HOW IT WORKS
            </p>
            <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
              導入は4ステップ、最短10分で開始。
            </h2>
            <p className="mt-4 text-sm text-[var(--brand-gray)] sm:text-base">
              特別な機材・知識・人材は一切不要です。
            </p>
          </div>
        </Reveal>

        <RevealStagger className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Connector line for desktop */}
          <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-gradient-to-r from-transparent via-[var(--brand-orange)]/40 to-transparent lg:block" />

          {steps.map((step) => (
            <RevealItem key={step.num} className="grid">
              <TiltCard className="relative rounded-2xl border border-[var(--brand-border)] bg-white p-6 transition hover:border-[var(--brand-orange)] hover:shadow-lg">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-orange)] text-lg font-black text-white shadow-md">
                  {step.num}
                </div>
                <h3 className="mb-2 text-lg font-bold text-[var(--brand-ink)]">
                  {step.title}
                </h3>
                <p className="mb-3 text-sm leading-relaxed text-[var(--brand-gray)]">
                  {step.desc}
                </p>
                <p className="border-t border-dotted border-gray-300 pt-2 text-xs text-[var(--brand-orange-dark)]">
                  {step.detail}
                </p>
              </TiltCard>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

/* ============================================================
 * Pricing Section (料金プラン)
 * ============================================================ */
function PricingSection() {
  const features = [
    { label: "動画本数", standard: "月10本", premium: "月20本" },
    {
      label: "SNS自動投稿(Instagram・TikTok)",
      standard: true,
      premium: true,
    },
    { label: "ハッシュタグ・投稿時間の最適化", standard: true, premium: true },
    { label: "公式LINEの内見予約AI自動対応(24時間)", standard: false, premium: true },
    { label: "AI検索対策(SEO・AEO／毎月AIが自動更新)", standard: false, premium: true },
    { label: "月次効果分析レポート(再生数・問い合わせ・成約推移)", standard: false, premium: true },
    { label: "専任AI担当「ユキ」のデスク(動画の直し・投稿用画像・紹介文・御社の決まりごとの記憶)", standard: false, premium: true },
    { label: "専用動画ページ(物件動画をGoogle・AI検索が拾える形で公開／順次提供)", standard: false, premium: true },
    { label: "専属担当(LINE直通・優先対応)", standard: false, premium: true },
  ];

  const Check = () => (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
      ✓
    </span>
  );
  const Dash = () => <span className="text-gray-300">—</span>;

  return (
    <section
      id="pricing"
      className="relative bg-gradient-to-b from-[var(--brand-cream)] to-white py-20 sm:py-24"
    >
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
              PRICING
            </p>
            <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
              シンプルな2プラン。
            </h2>
            <p className="mt-4 text-sm text-[var(--brand-gray)] sm:text-base">
              まずは無料お試しパック(動画5本)から。自動継続なし・契約期間の縛りもありません。
            </p>
          </div>
        </Reveal>

        {/* Plan cards */}
        <RevealStagger className="grid gap-6 lg:grid-cols-2">
          {/* Standard */}
          <RevealItem className="grid">
            <div className="relative flex flex-col rounded-3xl border-2 border-[var(--brand-border)] bg-white p-8 shadow-lg">
              <div className="mb-1 text-sm font-bold tracking-widest text-[var(--brand-orange-dark)]">
                STANDARD
              </div>
              <h3 className="text-2xl font-black text-[var(--brand-ink)]">
                スタンダード
              </h3>
              <p className="mt-1 text-xs text-[var(--brand-gray)]">
                動画制作からSNS運用まで全部お任せ
              </p>
              <div className="mt-6 flex items-baseline">
                <span className="text-5xl font-black text-[var(--brand-orange)]">
                  <CountUp value={100000} prefix="¥" />
                </span>
                <span className="ml-1 text-sm text-[var(--brand-gray)]">/月</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-[var(--brand-gray)]">
                <li className="flex items-start gap-2">
                  <Check /> 動画月10本の制作・納品
                </li>
                <li className="flex items-start gap-2">
                  <Check /> 台本・ナレーション・テロップ自動制作
                </li>
                <li className="flex items-start gap-2">
                  <Check /> SNS自動投稿(Instagram・TikTok)
                </li>
                <li className="flex items-start gap-2">
                  <Check /> ハッシュタグ・投稿時間の最適化
                </li>
                <li className="flex items-start gap-2">
                  <Check /> 仕上がりはマイページで確認・修正依頼
                </li>
              </ul>
              <a
                href="#contact"
                className="mt-8 inline-flex items-center justify-center rounded-full bg-[var(--brand-orange)] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:translate-y-[-1px] hover:bg-[var(--brand-orange-dark)]"
              >
                スタンダードを試す →
              </a>
            </div>
          </RevealItem>

          {/* Premium */}
          <RevealItem className="grid">
            <div className="relative flex flex-col rounded-3xl border border-[var(--brand-ink)] bg-gradient-to-br from-[var(--brand-ink)] to-gray-800 p-8 text-white shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-4 py-1 text-xs font-bold text-white shadow-md">
                WEBマーケ全部入り
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-orange)] px-4 py-1 text-xs font-bold text-white shadow-md">
                おすすめ
              </div>
              <div className="mb-1 text-sm font-bold tracking-widest text-[var(--brand-orange-light)]">
                PREMIUM
              </div>
              <h3 className="text-2xl font-black">プレミアム</h3>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                動画 × SNS × LINE × AI検索 × 分析。
                <br />
                WEBマーケティング部門ごと、AIに丸投げ。
              </p>
              <div className="mt-6 flex items-baseline">
                <span className="text-5xl font-black text-[var(--brand-orange-light)]">
                  <CountUp value={300000} prefix="¥" />
                </span>
                <span className="ml-1 text-sm text-white/60">/月</span>
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                ※ 業界相場 月¥90〜225万の半額以下
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-white/85">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  動画月20本(スタンダードの2倍)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  SNS自動投稿+ハッシュタグ最適化
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  公式LINEの内見予約AI自動対応(24時間)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  AI検索対策(SEO・AEO／毎月AIが自動更新)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  月次効果分析レポート(翌月の打ち手を毎月更新)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  専任AI担当「ユキ」のデスク(動画の直し・投稿用画像・紹介文)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  専用動画ページ(AI検索が拾える形で公開／順次提供)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                  専属担当(LINE直通・優先対応)
                </li>
              </ul>
              <a
                href="#contact"
                className="mt-8 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-orange-light)] bg-transparent px-6 py-3 text-sm font-bold text-[var(--brand-orange-light)] transition hover:bg-[var(--brand-orange-light)] hover:text-[var(--brand-ink)]"
              >
                プレミアムを相談する
              </a>
            </div>
          </RevealItem>
        </RevealStagger>

        {/* Feature comparison table */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--brand-border)] bg-gray-50 px-6 py-4">
            <h3 className="text-sm font-bold text-[var(--brand-ink)]">
              機能比較表
            </h3>
            <span className="text-[10px] text-[var(--brand-gray-light)] sm:hidden">
              ← 横スクロールできます →
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--brand-border)] text-xs">
                <th className="whitespace-nowrap px-4 py-3 text-left font-bold text-[var(--brand-gray)]">
                  機能
                </th>
                <th className="whitespace-nowrap bg-[var(--brand-cream)] px-4 py-3 text-center font-bold text-[var(--brand-orange-dark)]">
                  スタンダード
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-center font-bold text-[var(--brand-gray)]">
                  プレミアム
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--brand-border)] last:border-none"
                >
                  <td className="px-4 py-3 text-left text-[var(--brand-ink)]">
                    {f.label}
                  </td>
                  <td className="bg-[var(--brand-cream)]/40 px-4 py-3 text-center">
                    {typeof f.standard === "boolean" ? (
                      f.standard ? (
                        <Check />
                      ) : (
                        <Dash />
                      )
                    ) : (
                      <span className="text-xs font-bold text-[var(--brand-ink)]">
                        {f.standard}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {typeof f.premium === "boolean" ? (
                      f.premium ? (
                        <Check />
                      ) : (
                        <Dash />
                      )
                    ) : (
                      <span className="text-xs font-black text-[var(--brand-orange-dark)]">
                        {f.premium}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--brand-gray-light)]">
          ※ 無料お試しパックあり(動画5本・自動継続なし)／契約期間の縛りなし／いつでも解約OK
          <br />
          ※ フランチャイズ・複数店舗運営は別途ご相談ください
        </p>
      </div>
    </section>
  );
}

/* ============================================================
 * FAQ Section
 * ============================================================ */
function FaqSection() {

  return (
    <section id="faq" className="relative bg-white py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-3xl px-6 sm:px-8">
        <Reveal>
          <div className="mb-14 text-center">
            <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
              FAQ
            </p>
            <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
              よくあるご質問
            </h2>
          </div>
        </Reveal>

        <RevealStagger className="space-y-3">
          {faqs.map((item, i) => (
            <RevealItem
              key={i}
              as="details"
              className="group rounded-2xl border border-[var(--brand-border)] bg-white transition hover:border-[var(--brand-orange)]/60 open:border-[var(--brand-orange)] open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-bold text-[var(--brand-ink)]">
                <span className="flex items-start gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-orange)] text-sm font-black text-white">
                    Q
                  </span>
                  <span className="pt-0.5 text-sm sm:text-base">
                    {item.q}
                  </span>
                </span>
                <span className="flex-shrink-0 text-[var(--brand-orange)] transition group-open:rotate-45">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <div className="border-t border-[var(--brand-border)] px-6 py-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--brand-ink)] text-sm font-black text-white">
                    A
                  </span>
                  <p className="pt-0.5 text-sm leading-relaxed text-[var(--brand-gray)] sm:text-base">
                    {item.a}
                  </p>
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}

/* ============================================================
 * Contact Section (お問い合わせフォーム)
 * ============================================================ */
function ContactSection() {
  // Formspree: 後で FORMSPREE_ENDPOINT を .env.local か直書きで設定
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/mgorpwjd";

  return (
    <section
      id="contact"
      className="relative bg-gradient-to-br from-[var(--brand-ink)] via-gray-900 to-[var(--brand-ink)] py-20 sm:py-24"
    >
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-3xl px-6 sm:px-8">
        <Reveal>
          <div className="mb-10 text-center">
            <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange-light)]">
              CONTACT
            </p>
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              まずは無料お試しパックから。
            </h2>
            <p className="mt-4 text-sm text-white/70 sm:text-base">
              以下のフォームよりお問い合わせください。通常1〜2営業日以内にご返信いたします。
            </p>
          </div>
        </Reveal>

        <Reveal>
          <form
            action={FORMSPREE_ENDPOINT}
            method="POST"
            className="rounded-3xl bg-white p-8 shadow-2xl sm:p-10"
          >
            {/* Honeypot field for spam protection */}
            <input
              type="text"
              name="_gotcha"
              tabIndex={-1}
              autoComplete="off"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
              aria-hidden="true"
            />
            {/* Redirect back to our own thank-you page instead of formspree.io */}
            <input type="hidden" name="_next" value="https://byakuyaai.com/thanks" />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="会社名" name="company" required />
              <FormField label="お名前" name="name" required />
              <FormField label="メールアドレス" name="email" type="email" required />
              <FormField label="電話番号(任意)" name="phone" type="tel" />

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[var(--brand-ink)]">
                  物件種別 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {["賃貸", "売買", "両方"].map((v) => (
                    <label
                      key={v}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--brand-border)] bg-white px-4 py-2 text-sm transition hover:border-[var(--brand-orange)]"
                    >
                      <input
                        type="radio"
                        name="property_type"
                        value={v}
                        required
                        className="accent-[var(--brand-orange)]"
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[var(--brand-ink)]">
                  月の物件数目安 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {["〜10件", "10〜30件", "30件〜"].map((v) => (
                    <label
                      key={v}
                      className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--brand-border)] bg-white px-4 py-2 text-sm transition hover:border-[var(--brand-orange)]"
                    >
                      <input
                        type="radio"
                        name="volume"
                        value={v}
                        required
                        className="accent-[var(--brand-orange)]"
                      />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[var(--brand-ink)]">
                  希望プラン
                </label>
                <div className="flex flex-wrap gap-3">
                  {["スタンダード", "プレミアム", "未定・相談希望"].map(
                    (v) => (
                      <label
                        key={v}
                        className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--brand-border)] bg-white px-4 py-2 text-sm transition hover:border-[var(--brand-orange)]"
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={v}
                          className="accent-[var(--brand-orange)]"
                        />
                        {v}
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-bold text-[var(--brand-ink)]">
                  お問い合わせ内容
                </label>
                <textarea
                  name="message"
                  rows={5}
                  placeholder="ご質問・ご相談など、お気軽にお書きください。"
                  className="w-full rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)] outline-none transition focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-8 flex w-full items-center justify-center rounded-full bg-[var(--brand-orange)] px-8 py-4 text-base font-bold text-white shadow-lg shadow-orange-200 transition hover:translate-y-[-1px] hover:bg-[var(--brand-orange-dark)] hover:shadow-xl"
            >
              無料お試しパックを申し込む
              <span className="ml-2 text-lg">→</span>
            </button>

            <p className="mt-4 text-center text-xs text-[var(--brand-gray-light)]">
              送信前に{" "}
              <a
                href="/privacy"
                className="underline hover:text-[var(--brand-orange-dark)]"
              >
                プライバシーポリシー
              </a>{" "}
              をご確認ください。
              <br />
              いただいた情報は本件のご連絡にのみ使用し、第三者には共有しません。
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

function FormField({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-[var(--brand-ink)]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full rounded-xl border border-[var(--brand-border)] bg-white px-4 py-3 text-sm text-[var(--brand-ink)] outline-none transition focus:border-[var(--brand-orange)] focus:ring-2 focus:ring-[var(--brand-orange)]/20"
      />
    </div>
  );
}

/* ============================================================
 * Site Footer
 * ============================================================ */
function SiteFooter() {
  return (
    <footer className="border-t border-[var(--brand-border)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <Image
              src="/logo.png"
              alt="ByakuyaAI"
              width={140}
              height={42}
              className="h-10 w-auto"
            />
            <p className="mt-4 text-sm font-bold text-[var(--brand-ink)]">
              AIは、眠らない。
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--brand-gray)]">
              不動産集客を AI で自動化する SaaS プロダクト。
              <br />
              賃貸・売買どちらの物件にも対応。
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-xs font-bold tracking-widest text-[var(--brand-gray-light)]">
              サービス
            </h4>
            <ul className="space-y-2 text-sm text-[var(--brand-gray)]">
              <li>
                <a href="#flow" className="hover:text-[var(--brand-orange)]">
                  導入の流れ
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-[var(--brand-orange)]">
                  料金プラン
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-[var(--brand-orange)]">
                  よくある質問
                </a>
              </li>
              <li>
                <a href="/blog" className="hover:text-[var(--brand-orange)]">
                  ブログ
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-[var(--brand-orange)]">
                  お問い合わせ
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-3 text-xs font-bold tracking-widest text-[var(--brand-gray-light)]">
              会社情報
            </h4>
            <ul className="space-y-2 text-sm text-[var(--brand-gray)]">
              <li>
                <strong className="text-[var(--brand-ink)]">ByakuyaAI</strong>
                <br />
                代表 岡本 壮司
              </li>
              <li>
                <a
                  href="mailto:info@byakuyaai.com"
                  className="hover:text-[var(--brand-orange)]"
                >
                  info@byakuyaai.com
                </a>
              </li>
              <li>080-6260-9731</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--brand-border)] pt-6 text-xs text-[var(--brand-gray-light)] sm:flex-row">
          <span>© 2026 ByakuyaAI. All rights reserved.</span>
          <div className="flex flex-wrap justify-center gap-5">
            <a href="/tos" className="hover:text-[var(--brand-orange)]">
              利用規約
            </a>
            <a href="/privacy" className="hover:text-[var(--brand-orange)]">
              プライバシーポリシー
            </a>
            <a href="/tokushoho" className="hover:text-[var(--brand-orange)]">
              特定商取引法に基づく表示
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
