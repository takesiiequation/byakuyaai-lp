import Image from "next/image";
import { faqs } from "./_data/faqs";
import { JsonLd } from "./_components/JsonLd";

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <JsonLd />
      <SiteHeader />
      <Hero />
      <BannerShowcase />
      <PainSection />
      <CostCompareSection />
      <FlowSection />
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
            14日間 無料で試す
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
      {/* Left accent bar — brand consistency with A4 proposal */}
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:py-24">
        {/* Left: Copy */}
        <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--brand-orange)] bg-white px-4 py-1.5 text-xs font-bold tracking-wider text-[var(--brand-orange-dark)]">
            <span className="text-[var(--brand-orange)]">✓</span>
            賃貸
            <span className="text-[var(--brand-orange)]">✓</span>
            売買 どちらにも対応
          </div>

          <h1 className="text-[2.25rem] font-black leading-[1.2] tracking-tight text-[var(--brand-ink)] sm:text-5xl lg:text-[3.5rem]">
            写真を送るだけ。
            <br />
            あとは
            <span className="relative mx-1 inline-block text-[var(--brand-orange)]">
              AI
              <span className="absolute inset-x-0 -bottom-1 h-1 rounded-full bg-[var(--brand-orange)]/80"></span>
            </span>
            が
            <br className="sm:hidden" />
            全部やります。
          </h1>

          <p className="mt-6 text-base leading-relaxed text-[var(--brand-gray)] sm:text-lg">
            マイソクと物件写真をアップロードするだけで、
            <br className="hidden sm:block" />
            プロ品質のショート動画を毎日自動で生成・配信。
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-orange)] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-200 transition hover:translate-y-[-1px] hover:bg-[var(--brand-orange-dark)] hover:shadow-xl"
            >
              14日間 無料で試す
              <span className="ml-2 text-lg">→</span>
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-orange)] bg-white px-7 py-3 text-base font-bold text-[var(--brand-orange-dark)] transition hover:bg-[var(--brand-cream)]"
            >
              料金プランを見る
            </a>
          </div>

          <p className="mt-4 text-xs text-[var(--brand-gray-light)]">
            契約期間の縛りなし／いつでも解約OK
          </p>
        </div>

        {/* Right: Video placeholder */}
        <div className="flex items-center justify-center">
          <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-3xl border-[6px] border-[var(--brand-ink)] bg-gradient-to-br from-gray-900 to-gray-700 shadow-2xl sm:max-w-[320px]">
            {/* Phone notch */}
            <div className="absolute left-1/2 top-0 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-[var(--brand-ink)]" />
            {/* Placeholder content */}
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-orange)]/90 shadow-lg">
                <svg
                  className="h-7 w-7 translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-center text-xs font-bold tracking-wider text-white/80">
                サンプル動画
                <br />
                準備中
              </p>
              <div className="mt-2 rounded-full bg-white/10 px-3 py-1 text-[10px] text-white/70">
                45秒 / 縦型ショート
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Banner Showcase (full-width hero banner break)
 * ============================================================ */
function BannerShowcase() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[var(--brand-cream-2)] via-[var(--brand-cream)] to-white py-8 sm:py-10 lg:py-10">
      {/* Soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[110%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-orange)]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-5xl lg:px-6 xl:max-w-6xl">
        <div className="mb-4 text-center sm:mb-5">
          <p className="mb-1 text-[10px] font-bold tracking-[0.25em] text-[var(--brand-orange)] sm:text-xs">
            CONCEPT
          </p>
          <h2 className="text-lg font-black leading-snug text-[var(--brand-ink)] sm:text-xl lg:text-2xl">
            あなたの会社専属の、
            <br className="sm:hidden" />
            AI 広報担当者です。
          </h2>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-orange-200/40 ring-1 ring-black/5 sm:rounded-3xl">
          <Image
            src="/banner.png"
            alt="月10万円で、SNS担当者を雇う。24時間眠らない、AI不動産動画クリエイター ByakuyaAI"
            width={1024}
            height={768}
            priority
            sizes="(min-width: 1280px) 1152px, (min-width: 1024px) 1024px, 100vw"
            className="block h-auto w-full"
          />

          {/* Spec badge — bottom center */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-ink)]/85 px-4 py-1.5 text-[10px] font-bold tracking-wider text-white shadow-lg backdrop-blur-sm sm:bottom-4 sm:px-5 sm:py-2 sm:text-xs">
            45秒 / 縦型ショート
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-[var(--brand-gray)] sm:mt-6 sm:text-sm">
          外注ライター・動画編集者・SNS運用代行を一人にまとめたら、
          <br className="hidden sm:block" />
          24時間眠らず働く ByakuyaAI になりました。
        </p>
      </div>
    </section>
  );
}

/* ============================================================
 * Pain Section
 * ============================================================ */
function PainSection() {
  const pains = [
    {
      title: "SNS で何を投稿すればいいか分からない",
      desc: "Instagram・TikTok を始めたいが、撮影も編集もノウハウもない。",
    },
    {
      title: "外注コストが高すぎる",
      desc: "動画1本に1〜3万円、SNS運用代行は月25〜50万円。投資回収が見えない。",
    },
    {
      title: "ポータルサイト頼みから抜け出せない",
      desc: "SUUMO・at home の掲載料は上がる一方。差別化できず価格競争に陥る。",
    },
  ];

  return (
    <section className="relative bg-white py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
            PROBLEM
          </p>
          <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
            こんなお悩み、ありませんか？
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {pains.map((pain, i) => (
            <div
              key={i}
              className="group relative rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-cream)] p-7 transition hover:border-[var(--brand-orange)] hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-orange)] font-black text-white">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mb-3 text-lg font-bold leading-snug text-[var(--brand-ink)]">
                {pain.title}
              </h3>
              <p className="text-sm leading-relaxed text-[var(--brand-gray)]">
                {pain.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Cost Comparison Section
 * ============================================================ */
function CostCompareSection() {
  return (
    <section className="relative bg-gradient-to-b from-white to-[var(--brand-cream)] py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
            COST COMPARISON
          </p>
          <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
            SNS の運用コスト、比べてみてください。
          </h2>
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-[1fr_auto_1fr]">
          {/* Traditional */}
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm">
            <div className="mb-1 text-xs font-bold tracking-widest text-[var(--brand-gray-light)]">
              従来の方法
            </div>
            <div className="mb-6 text-xl font-bold text-[var(--brand-ink)]">
              人に頼む場合
            </div>

            <ul className="space-y-3 text-sm">
              <CostRow label="ショート動画の制作外注" cost="1〜3万円/本" />
              <CostRow label="SNS運用代行" cost="25〜50万円/月" />
              <CostRow label="自社で採用する" cost="25〜40万円/月" />
            </ul>

            <div className="mt-6 border-t-2 border-gray-300 pt-4">
              <div className="text-xs text-[var(--brand-gray-light)]">
                月額目安（いずれか選択）
              </div>
              <div className="text-3xl font-black text-[#c0392b]">
                ¥25〜50万
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-ink)] text-lg font-black tracking-wider text-white shadow-lg">
              VS
            </div>
          </div>

          {/* ByakuyaAI */}
          <div className="relative rounded-3xl border-2 border-[var(--brand-orange)] bg-gradient-to-br from-[#fff8ee] to-[var(--brand-cream-2)] p-8 shadow-xl">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-orange)] px-4 py-1 text-xs font-bold text-white shadow-md">
              圧倒的コスト削減
            </div>

            <div className="mb-1 text-xs font-bold tracking-widest text-[var(--brand-orange-dark)]">
              ByakuyaAI
            </div>
            <div className="mb-6 text-xl font-bold text-[var(--brand-orange-dark)]">
              AI に任せる場合
            </div>

            <ul className="space-y-3 text-sm">
              <CostRow label="AI 動画制作(月20本)" cost="込み" highlight />
              <CostRow label="SNS自動投稿・分析レポート" cost="込み" highlight />
              <CostRow label="採用・教育・要件定義の工数" cost="¥0" highlight />
            </ul>

            <div className="mt-6 border-t-2 border-[var(--brand-orange)] pt-4">
              <div className="text-xs text-[var(--brand-gray-light)]">
                月額(スタンダードプラン)
              </div>
              <div className="text-3xl font-black text-[var(--brand-orange)]">
                ¥100,000
              </div>
            </div>
          </div>
        </div>

        {/* Savings bar */}
        <div className="mt-10 flex items-center justify-center rounded-2xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-6 py-5 text-center shadow-lg">
          <p className="text-base font-bold leading-snug text-white sm:text-lg">
            外注と比較して 月15〜40万円
            <span className="mx-2 text-white/70">→</span>
            <span className="text-2xl font-black sm:text-3xl">
              年間最大 ¥480万円
            </span>
            <span className="ml-2">のコスト削減</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function CostRow({
  label,
  cost,
  highlight = false,
}: {
  label: string;
  cost: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-dotted border-gray-300 pb-2.5 last:border-none">
      <span className="text-[var(--brand-gray)]">{label}</span>
      <span
        className={`whitespace-nowrap font-bold ${
          highlight
            ? "text-[var(--brand-orange-dark)]"
            : "text-[var(--brand-ink)]"
        }`}
      >
        {cost}
      </span>
    </li>
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
      desc: "バーチャルステージング（空室に家具合成）、ナレーション、BGM、テロップまで AI が自動制作。",
      detail: "生成時間: 約15〜30分",
    },
    {
      num: "04",
      title: "SNS に自動投稿",
      desc: "Instagram・TikTok・YouTube Shorts に最適な時間帯で自動投稿。ハッシュタグも AI が最適化。",
      detail: "手動投稿も可能",
    },
  ];

  return (
    <section id="flow" className="relative bg-white py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
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

        <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Connector line for desktop */}
          <div className="absolute left-0 right-0 top-10 hidden h-0.5 bg-gradient-to-r from-transparent via-[var(--brand-orange)]/40 to-transparent lg:block" />

          {steps.map((step) => (
            <div
              key={step.num}
              className="relative rounded-2xl border border-[var(--brand-border)] bg-white p-6 transition hover:border-[var(--brand-orange)] hover:shadow-lg"
            >
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Pricing Section (料金プラン)
 * ============================================================ */
function PricingSection() {
  const features = [
    { label: "動画本数", light: "月10本", standard: "月20本", premium: "毎日自動配信" },
    { label: "バーチャルステージング", light: true, standard: true, premium: true },
    {
      label: "SNS自動投稿(Instagram/TikTok/YouTube)",
      light: false,
      standard: true,
      premium: true,
    },
    { label: "ハッシュタグ・投稿時間の最適化", light: false, standard: true, premium: true },
    { label: "効果分析レポート(月次)", light: false, standard: true, premium: true },
    { label: "LINE公式アカウントのAI自動応答", light: false, standard: false, premium: true },
    { label: "まとめて物件登録するだけで全自動運用", light: false, standard: false, premium: true },
    { label: "優先サポート(LINE直通)", light: false, standard: false, premium: true },
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
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
            PRICING
          </p>
          <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
            シンプルな3プラン。
          </h2>
          <p className="mt-4 text-sm text-[var(--brand-gray)] sm:text-base">
            まずは14日間、無料でお試しください。契約期間の縛りはありません。
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Light */}
          <div className="flex flex-col rounded-3xl border border-[var(--brand-border)] bg-white p-8 shadow-sm">
            <div className="mb-1 text-sm font-bold tracking-widest text-[var(--brand-gray-light)]">
              LIGHT
            </div>
            <h3 className="text-2xl font-black text-[var(--brand-ink)]">ライト</h3>
            <p className="mt-1 text-xs text-[var(--brand-gray)]">
              まずは動画だけ試したい方へ
            </p>
            <div className="mt-6 flex items-baseline">
              <span className="text-4xl font-black text-[var(--brand-ink)]">
                ¥50,000
              </span>
              <span className="ml-1 text-sm text-[var(--brand-gray)]">/月</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-[var(--brand-gray)]">
              <li className="flex items-start gap-2">
                <Check /> 動画月10本の制作・納品
              </li>
              <li className="flex items-start gap-2">
                <Check /> バーチャルステージング込み
              </li>
              <li className="flex items-start gap-2 text-gray-400">
                <Dash /> SNS投稿は自社運用
              </li>
            </ul>
            <a
              href="#contact"
              className="mt-8 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-orange)] bg-white px-6 py-3 text-sm font-bold text-[var(--brand-orange-dark)] transition hover:bg-[var(--brand-cream)]"
            >
              ライトを試す
            </a>
          </div>

          {/* Standard (recommended) */}
          <div className="relative flex flex-col rounded-3xl border-2 border-[var(--brand-orange)] bg-white p-8 shadow-2xl lg:-translate-y-3">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-orange)] px-4 py-1 text-xs font-bold text-white shadow-md">
              おすすめ
            </div>
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
                ¥100,000
              </span>
              <span className="ml-1 text-sm text-[var(--brand-gray)]">/月</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-[var(--brand-gray)]">
              <li className="flex items-start gap-2">
                <Check /> 動画月20本の制作・納品
              </li>
              <li className="flex items-start gap-2">
                <Check /> バーチャルステージング込み
              </li>
              <li className="flex items-start gap-2">
                <Check /> SNS自動投稿(Instagram/TikTok/YouTube)
              </li>
              <li className="flex items-start gap-2">
                <Check /> ハッシュタグ・投稿時間の最適化
              </li>
              <li className="flex items-start gap-2">
                <Check /> 月次分析レポート
              </li>
            </ul>
            <a
              href="#contact"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[var(--brand-orange)] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:translate-y-[-1px] hover:bg-[var(--brand-orange-dark)]"
            >
              スタンダードを試す →
            </a>
          </div>

          {/* Premium */}
          <div className="flex flex-col rounded-3xl border border-[var(--brand-ink)] bg-gradient-to-br from-[var(--brand-ink)] to-gray-800 p-8 text-white shadow-lg">
            <div className="mb-1 text-sm font-bold tracking-widest text-[var(--brand-orange-light)]">
              PREMIUM
            </div>
            <h3 className="text-2xl font-black">プレミアム</h3>
            <p className="mt-1 text-xs text-white/60">
              AI完全おまかせ運用 / 毎日自動配信
            </p>
            <div className="mt-6 flex items-baseline">
              <span className="text-4xl font-black text-[var(--brand-orange-light)]">
                ¥300,000
              </span>
              <span className="ml-1 text-sm text-white/60">/月</span>
            </div>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                毎日自動配信(月30本相当)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                スタンダードの全機能
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                LINE公式のAI自動応答
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                まとめて物件登録するだけで全自動
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[var(--brand-orange-light)]">✓</span>{" "}
                優先サポート(LINE直通)
              </li>
            </ul>
            <a
              href="#contact"
              className="mt-8 inline-flex items-center justify-center rounded-full border-2 border-[var(--brand-orange-light)] bg-transparent px-6 py-3 text-sm font-bold text-[var(--brand-orange-light)] transition hover:bg-[var(--brand-orange-light)] hover:text-[var(--brand-ink)]"
            >
              プレミアムを相談する
            </a>
          </div>
        </div>

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
                <th className="whitespace-nowrap px-4 py-3 text-center font-bold text-[var(--brand-gray)]">
                  ライト
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
                  <td className="px-4 py-3 text-center">
                    {typeof f.light === "boolean" ? (
                      f.light ? (
                        <Check />
                      ) : (
                        <Dash />
                      )
                    ) : (
                      <span className="text-xs font-bold text-[var(--brand-ink)]">
                        {f.light}
                      </span>
                    )}
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
          ※ 14日間の無料トライアルあり／契約期間の縛りなし／いつでも解約OK
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
        <div className="mb-14 text-center">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange)]">
            FAQ
          </p>
          <h2 className="text-3xl font-black text-[var(--brand-ink)] sm:text-4xl">
            よくあるご質問
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item, i) => (
            <details
              key={i}
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
            </details>
          ))}
        </div>
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
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange-light)]">
            CONTACT
          </p>
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            まずは14日間、無料でお試しください。
          </h2>
          <p className="mt-4 text-sm text-white/70 sm:text-base">
            以下のフォームよりお問い合わせください。通常1〜2営業日以内にご返信いたします。
          </p>
        </div>

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
                {["ライト", "スタンダード", "プレミアム", "未定・相談希望"].map(
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
            無料トライアルを申し込む
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
