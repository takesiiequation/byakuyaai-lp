"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Plan = "standard" | "premium";

const STANDARD_PAINS = [
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

// プレミアム: 「叶えたい世界」訴求
const PREMIUM_WANTS = [
  {
    title: "WEB施策がバラバラで管理しきれない",
    desc: "動画・SNS・LINE・HP・SEO・分析。会社が違うとデータも分断、PDCAが回らない。全部まとめて一元管理したい。",
  },
  {
    title: "Google・SNSのアルゴリズムを賢く攻略したい",
    desc: "感覚ではなく、ロジカルに勝てる打ち手を毎月自動で更新。アルゴリズム変動にも追従して、AIが学習しながら最適化し続ける。",
  },
  {
    title: "寝てる間に、お問い合わせと内見予約が入っていてほしい",
    desc: "24時間応対するAI営業マン。朝起きたら、スケジューラに昨夜の予約が3件。営業時間外の取りこぼしをゼロに。",
  },
];

const STANDARD_COSTS = {
  title: "SNS の運用コスト、比べてみてください。",
  outsource: {
    label: "従来の方法",
    sub: "人に頼む場合",
    rows: [
      { label: "ショート動画の制作外注", cost: "1〜3万円/本" },
      { label: "SNS運用代行", cost: "25〜50万円/月" },
      { label: "自社で採用する", cost: "25〜40万円/月" },
    ],
    totalLabel: "月額目安(いずれか選択)",
    total: "¥25〜50万",
  },
  ai: {
    label: "ByakuyaAI スタンダード",
    sub: "AI に任せる場合",
    rows: [
      { label: "AI 動画制作(月10本)", cost: "込み" },
      { label: "SNS自動投稿・最適化", cost: "込み" },
      { label: "採用・教育・要件定義の工数", cost: "¥0" },
    ],
    totalLabel: "月額(スタンダードプラン)",
    total: "¥100,000",
  },
  savings: "外注と比較して 月15〜40万円 → 年間最大 ¥480万円 のコスト削減",
};

const PREMIUM_COSTS = {
  title: "WEBマーケ業者を、6社雇いますか？それともAIに、丸投げしますか？",
  outsource: {
    label: "個別に外注した場合",
    sub: "6社それぞれに発注",
    rows: [
      { label: "動画制作会社", cost: "月¥30〜60万" },
      { label: "SNS運用代行", cost: "月¥25〜50万" },
      { label: "LINE構築・運用", cost: "月¥10〜30万" },
      { label: "SEO対策会社", cost: "月¥15〜50万" },
      { label: "HP運用サポート", cost: "月¥5〜20万" },
      { label: "月次レポート分析", cost: "月¥5〜15万" },
    ],
    totalLabel: "合計(月額)",
    total: "¥90〜225万",
  },
  ai: {
    label: "ByakuyaAI プレミアム",
    sub: "AIに、まるごとお任せ",
    rows: [
      { label: "動画月20本+ステージング", cost: "込み" },
      { label: "SNS自動投稿+最適化", cost: "込み" },
      { label: "LINE公式AI自動応答", cost: "込み" },
      { label: "SEO対策(地域KW・物件ページ)", cost: "込み" },
      { label: "専用動画サイト無料構築", cost: "込み" },
      { label: "月次効果分析レポート", cost: "込み" },
    ],
    totalLabel: "月額(プレミアムプラン)",
    total: "¥300,000",
  },
  savings:
    "個別外注と比較して 月60〜195万円 → 年間最大 ¥2,340万円 のコスト削減",
};

export function PlanSwitcher() {
  const [plan, setPlan] = useState<Plan>("standard");
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isPremium = plan === "premium";

  // Compact tab when the sentinel (placed just above the sticky bar)
  // scrolls out of view — i.e. the bar has become "stuck".
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsCompact(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative">
      {/* Sentinel: when this leaves viewport, sticky bar has engaged */}
      <div ref={sentinelRef} aria-hidden className="h-px w-px" />

      {/* Tab bar (sticky at section top) */}
      <div
        className={`sticky top-16 z-30 border-b backdrop-blur-md transition-all duration-300 ${
          isPremium
            ? "border-[var(--brand-orange)]/40 bg-black/90 shadow-[0_4px_24px_rgba(247,147,30,0.25)]"
            : "border-[var(--brand-border)] bg-white/90 shadow-sm"
        }`}
      >
        <div
          className={`mx-auto max-w-6xl transition-all duration-300 ${
            isCompact
              ? "px-3 py-1.5 sm:px-6 sm:py-2"
              : "px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
          }`}
        >
          {!isCompact && (
            <p
              className={`mb-3 text-center text-[10px] font-bold tracking-[0.3em] sm:text-xs ${
                isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange)]"
              }`}
            >
              ▼ プランを切り替えてご覧ください ▼
            </p>
          )}
          <div className="flex items-stretch justify-center gap-2 sm:gap-3">
            <TabButton
              active={plan === "standard"}
              premiumActive={isPremium}
              onClick={() => setPlan("standard")}
              label="スタンダード"
              price="¥10万/月"
              highlight={false}
              compact={isCompact}
            />
            <TabButton
              active={plan === "premium"}
              premiumActive={isPremium}
              onClick={() => setPlan("premium")}
              label="プレミアム"
              price="¥30万/月"
              highlight={true}
              compact={isCompact}
            />
          </div>
        </div>
      </div>

      {/* Plan-specific content */}
      <div
        className={`relative transition-colors duration-700 ${
          isPremium ? "electric-bg premium-frame overflow-hidden" : "bg-white"
        }`}
      >
        {isPremium && (
          <>
            <span className="frame-left" aria-hidden />
            <span className="frame-right" aria-hidden />
          </>
        )}
        <BannerByPlan plan={plan} />
        <PainByPlan plan={plan} />
        {isPremium && <CycleSection />}
        <CostCompareByPlan plan={plan} />
      </div>
    </div>
  );
}

/* ============================================================
 * Cycle Infographic Section (premium only)
 * ============================================================ */
function CycleSection() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-10 text-center">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-[var(--brand-orange-light)]">
            HOW IT WORKS
          </p>
          <h2 className="text-2xl font-black text-white sm:text-3xl lg:text-4xl">
            物件を登録するだけで、AIが全部回す。
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">
            動画生成・SNS投稿・SEO・HP埋め込み・LINE応答まで自動化。
            <br className="hidden sm:block" />
            月次レポートで AI が学習し、毎月さらに賢くなります。
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-white p-3 shadow-2xl sm:rounded-3xl sm:p-4">
          <Image
            src="/cycle.png"
            alt="不動産集客の全自動サイクル - ByakuyaAI Premium が物件登録から月次レポートまで自動で回す業務フロー"
            width={1024}
            height={768}
            sizes="(min-width: 1280px) 1152px, (min-width: 1024px) 1024px, 100vw"
            className="block h-auto w-full rounded-xl sm:rounded-2xl"
          />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-white/60 sm:text-sm">
          ※ お客様の作業は「月初の物件情報登録」のみ。あとはすべて ByakuyaAI が自動で実行します。
        </p>
      </div>
    </section>
  );
}

function TabButton({
  active,
  premiumActive,
  onClick,
  label,
  price,
  highlight,
  compact,
}: {
  active: boolean;
  premiumActive: boolean;
  onClick: () => void;
  label: string;
  price: string;
  highlight: boolean;
  compact: boolean;
}) {
  const sizeClasses = compact
    ? "min-w-[110px] flex-row gap-1.5 rounded-full px-3 py-1.5 sm:min-w-[140px] sm:px-4 sm:py-2"
    : "min-w-[160px] flex-col gap-1 rounded-2xl px-6 py-4 sm:min-w-[220px] sm:gap-1.5 sm:px-10 sm:py-5";

  const base = `relative flex items-center justify-center font-bold transition-all duration-300 ${sizeClasses}`;

  const labelClass = compact ? "text-xs sm:text-sm" : "text-base sm:text-lg";
  const priceClass = compact
    ? "text-xs font-black opacity-90"
    : "text-sm font-black opacity-90 sm:text-base";

  if (active && highlight) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${
          compact ? "" : "neon-pulse scale-105"
        } bg-black text-[var(--brand-orange-light)] ring-2 ring-[var(--brand-orange)]`}
      >
        <span className={labelClass}>{label}</span>
        <span className={priceClass}>{price}</span>
      </button>
    );
  }

  if (active && !highlight) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${
          compact ? "" : "scale-105 shadow-xl shadow-orange-200"
        } bg-[var(--brand-orange)] text-white shadow-lg`}
      >
        <span className={labelClass}>{label}</span>
        <span className={priceClass}>{price}</span>
      </button>
    );
  }

  const inactiveStyle = premiumActive
    ? "border-2 border-white/25 bg-white/5 text-white/75 hover:bg-white/15 hover:text-white hover:border-white/50"
    : "border-2 border-[var(--brand-border)] bg-white text-[var(--brand-gray)] hover:border-[var(--brand-orange)] hover:text-[var(--brand-ink)] hover:bg-[var(--brand-cream)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${inactiveStyle}`}
    >
      <span className={labelClass}>{label}</span>
      <span className={priceClass}>{price}</span>
    </button>
  );
}

/* ============================================================
 * Banner per plan
 * ============================================================ */
function BannerByPlan({ plan }: { plan: Plan }) {
  const isPremium = plan === "premium";
  const slide = isPremium
    ? {
        badge: "PREMIUM",
        title: "月30万円で、WEBマーケティングチームを雇う。",
        sub: "動画・SNS・LINE・HP・SEO・分析レポートまで。不動産マーケの全部、AIに丸投げ。",
        image: "/banner-premium.png",
        alt: "月30万円で、WEBマーケティングチームを雇う ByakuyaAI",
        spec: "月20本 / WEBマーケ全部入り",
      }
    : {
        badge: "STANDARD",
        title: "月10万円で、SNS担当者を雇う。",
        sub: "24時間眠らない、AI不動産動画クリエイター。動画制作からSNS自動投稿まで全部おまかせ。",
        image: "/banner.png",
        alt: "月10万円で、SNS担当者を雇う ByakuyaAI",
        spec: "45秒 / 縦型ショート",
      };

  return (
    <section
      className={`relative ${
        isPremium ? "" : "bg-gradient-to-b from-[var(--brand-cream-2)] via-[var(--brand-cream)] to-white"
      } py-10 sm:py-12`}
    >
      {!isPremium && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[110%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-orange)]/10 blur-3xl"
        />
      )}

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-5xl lg:px-6 xl:max-w-6xl">
        <div className="mb-5 text-center">
          <p
            className={`mb-1 text-[10px] font-bold tracking-[0.25em] sm:text-xs ${
              isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange)]"
            }`}
          >
            {isPremium ? "PREMIUM CONCEPT" : "STANDARD CONCEPT"}
          </p>
          <h2
            className={`text-lg font-black leading-snug sm:text-xl lg:text-2xl ${
              isPremium ? "text-white" : "text-[var(--brand-ink)]"
            }`}
          >
            {isPremium ? (
              <>
                あなたの会社専属の、
                <br className="sm:hidden" />
                AIマーケティングチームです。
              </>
            ) : (
              <>
                あなたの会社専属の、
                <br className="sm:hidden" />
                AI 広報担当者です。
              </>
            )}
          </h2>
        </div>

        <div
          className={`relative overflow-hidden rounded-2xl sm:rounded-3xl ${
            isPremium
              ? "banner-neon"
              : "border border-white/80 bg-white shadow-2xl shadow-orange-200/40 ring-1 ring-black/5"
          }`}
        >
          <Image
            src={slide.image}
            alt={slide.alt}
            width={1024}
            height={768}
            priority
            sizes="(min-width: 1280px) 1152px, (min-width: 1024px) 1024px, 100vw"
            className="block h-auto w-full"
          />
        </div>

        <div className="mt-5 text-center">
          <p
            className={`text-sm font-black leading-snug sm:text-base lg:text-lg ${
              isPremium ? "text-white" : "text-[var(--brand-ink)]"
            }`}
          >
            {slide.title}
          </p>
          <p
            className={`mt-2 text-xs leading-relaxed sm:text-sm ${
              isPremium ? "text-white/70" : "text-[var(--brand-gray)]"
            }`}
          >
            {slide.sub}
          </p>
          <p
            className={`mt-3 inline-block rounded-full px-4 py-1 text-[10px] font-bold tracking-wider sm:text-xs ${
              isPremium
                ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange-light)] ring-1 ring-[var(--brand-orange)]/40"
                : "bg-[var(--brand-ink)]/85 text-white"
            }`}
          >
            {slide.spec}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Pain (or "Wants") per plan
 * ============================================================ */
function PainByPlan({ plan }: { plan: Plan }) {
  const isPremium = plan === "premium";
  const items = isPremium ? PREMIUM_WANTS : STANDARD_PAINS;

  return (
    <section className="relative py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <div className="mb-12 text-center">
          <p
            className={`mb-2 text-sm font-bold tracking-[0.2em] ${
              isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange)]"
            }`}
          >
            {isPremium ? "WHAT IF..." : "PROBLEM"}
          </p>
          <h2
            className={`text-3xl font-black sm:text-4xl ${
              isPremium ? "text-white" : "text-[var(--brand-ink)]"
            }`}
          >
            {isPremium
              ? "もし、こんなマーケティング体制が手に入ったら？"
              : "こんなお悩み、ありませんか？"}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={i}
              className={`group relative rounded-2xl p-7 transition ${
                isPremium
                  ? "neon-border text-white"
                  : "border border-[var(--brand-border)] bg-[var(--brand-cream)] hover:border-[var(--brand-orange)] hover:shadow-lg"
              }`}
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full font-black ${
                  isPremium
                    ? "bg-[var(--brand-orange)] text-white shadow-[0_0_18px_rgba(247,147,30,0.6)]"
                    : "bg-[var(--brand-orange)] text-white"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3
                className={`mb-3 text-lg font-bold leading-snug ${
                  isPremium ? "text-white" : "text-[var(--brand-ink)]"
                }`}
              >
                {item.title}
              </h3>
              <p
                className={`text-sm leading-relaxed ${
                  isPremium ? "text-white/75" : "text-[var(--brand-gray)]"
                }`}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
 * Cost Compare per plan
 * ============================================================ */
function CostCompareByPlan({ plan }: { plan: Plan }) {
  const isPremium = plan === "premium";
  const data = isPremium ? PREMIUM_COSTS : STANDARD_COSTS;

  return (
    <section className="relative py-20 sm:py-24">
      <div className="brand-accent-bar absolute left-0 top-0 h-full w-1.5 sm:w-2" />

      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        <div className="mb-14 text-center">
          <p
            className={`mb-2 text-sm font-bold tracking-[0.2em] ${
              isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange)]"
            }`}
          >
            {isPremium ? "PREMIUM COST COMPARISON" : "COST COMPARISON"}
          </p>
          <h2
            className={`text-2xl font-black sm:text-3xl lg:text-4xl ${
              isPremium ? "text-white" : "text-[var(--brand-ink)]"
            }`}
          >
            {data.title}
          </h2>
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-[1fr_auto_1fr]">
          {/* Outsource side */}
          <div
            className={`rounded-3xl p-8 shadow-sm ${
              isPremium
                ? "border border-white/15 bg-white/5 backdrop-blur-sm"
                : "border border-gray-200 bg-gray-50"
            }`}
          >
            <div
              className={`mb-1 text-xs font-bold tracking-widest ${
                isPremium ? "text-white/50" : "text-[var(--brand-gray-light)]"
              }`}
            >
              {data.outsource.label}
            </div>
            <div
              className={`mb-6 text-xl font-bold ${
                isPremium ? "text-white" : "text-[var(--brand-ink)]"
              }`}
            >
              {data.outsource.sub}
            </div>

            <ul className="space-y-3 text-sm">
              {data.outsource.rows.map((row) => (
                <CostRow
                  key={row.label}
                  label={row.label}
                  cost={row.cost}
                  dark={isPremium}
                />
              ))}
            </ul>

            <div
              className={`mt-6 border-t-2 pt-4 ${
                isPremium ? "border-white/20" : "border-gray-300"
              }`}
            >
              <div
                className={`text-xs ${
                  isPremium ? "text-white/50" : "text-[var(--brand-gray-light)]"
                }`}
              >
                {data.outsource.totalLabel}
              </div>
              <div className="text-3xl font-black text-[#ff6b6b]">
                {data.outsource.total}
              </div>
            </div>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center py-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-black tracking-wider shadow-lg ${
                isPremium
                  ? "bg-[var(--brand-orange)] text-black shadow-[0_0_20px_rgba(247,147,30,0.7)]"
                  : "bg-[var(--brand-ink)] text-white"
              }`}
            >
              VS
            </div>
          </div>

          {/* AI side */}
          <div
            className={`relative rounded-3xl p-8 shadow-xl ${
              isPremium
                ? "neon-border text-white"
                : "border-2 border-[var(--brand-orange)] bg-gradient-to-br from-[#fff8ee] to-[var(--brand-cream-2)]"
            }`}
          >
            <div
              className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-xs font-bold shadow-md ${
                isPremium
                  ? "bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-black"
                  : "bg-[var(--brand-orange)] text-white"
              }`}
            >
              {isPremium ? "WEBマーケ全部入り" : "圧倒的コスト削減"}
            </div>

            <div
              className={`mb-1 text-xs font-bold tracking-widest ${
                isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange-dark)]"
              }`}
            >
              {data.ai.label}
            </div>
            <div
              className={`mb-6 text-xl font-bold ${
                isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange-dark)]"
              }`}
            >
              {data.ai.sub}
            </div>

            <ul className="space-y-3 text-sm">
              {data.ai.rows.map((row) => (
                <CostRow
                  key={row.label}
                  label={row.label}
                  cost={row.cost}
                  highlight
                  dark={isPremium}
                />
              ))}
            </ul>

            <div
              className={`mt-6 border-t-2 pt-4 ${
                isPremium ? "border-[var(--brand-orange)]/40" : "border-[var(--brand-orange)]"
              }`}
            >
              <div
                className={`text-xs ${
                  isPremium ? "text-white/50" : "text-[var(--brand-gray-light)]"
                }`}
              >
                {data.ai.totalLabel}
              </div>
              <div
                className={`text-3xl font-black ${
                  isPremium ? "text-[var(--brand-orange-light)]" : "text-[var(--brand-orange)]"
                }`}
              >
                {data.ai.total}
              </div>
            </div>
          </div>
        </div>

        {/* Savings bar */}
        <div
          className={`mt-10 flex items-center justify-center rounded-2xl px-6 py-5 text-center shadow-lg ${
            isPremium
              ? "bg-gradient-to-r from-[var(--brand-orange-dark)] via-[var(--brand-orange)] to-[var(--brand-orange-light)] text-black"
              : "bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white"
          }`}
        >
          <p className="text-base font-black leading-snug sm:text-lg">
            {data.savings}
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
  dark = false,
}: {
  label: string;
  cost: string;
  highlight?: boolean;
  dark?: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 border-b border-dotted pb-2.5 last:border-none ${
        dark ? "border-white/15" : "border-gray-300"
      }`}
    >
      <span className={dark ? "text-white/75" : "text-[var(--brand-gray)]"}>
        {label}
      </span>
      <span
        className={`whitespace-nowrap font-bold ${
          highlight
            ? dark
              ? "text-[var(--brand-orange-light)]"
              : "text-[var(--brand-orange-dark)]"
            : dark
            ? "text-white"
            : "text-[var(--brand-ink)]"
        }`}
      >
        {cost}
      </span>
    </li>
  );
}
