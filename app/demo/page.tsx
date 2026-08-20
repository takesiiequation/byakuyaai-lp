import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";

/* ============================================================
 * /demo — 営業フォーム文面の着地ページ(2026-08-19)
 *
 * 文面B「実際の仕上がりはこちらです」のリンク先。従来は /#works で
 * 縦長LPの6セクション目に着地しており、「動画がすぐ見られる」という
 * 期待と体験が割れていた(岡本の実機確認 2026-08-19)。
 * このページは「開いた瞬間に動画・1タップで再生」だけを目的とする。
 *
 * 計測: ?b=<弾番号> を読み、既存のリンク計測基盤(n8n link-click →
 * 契約社スプシ「リンククリック」タブ)へ c=demo_b<N> で記録する。
 * n8n 側の検証は /^[a-z0-9_-]{1,40}$/ + d=hp|line なので無変更で通る。
 * これにより「営業文面が読まれているか」が弾別に初めて観測できる。
 *
 * SEO: 営業着地専用のため noindex(検索流入は / が担う)。
 * ============================================================ */

const LOG_URL = "https://aiboost-takeshi.app.n8n.cloud/webhook/link-click";

// 計測(after + headers)のためリクエスト毎に実行する。トラフィックは
// 営業リンク経由の少数なので SSR コストは無視できる。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "制作事例 — 50秒でご覧いただけます",
  description:
    "AIが物件写真から自動制作したSNSショート動画の実例(50秒)。撮影・編集は不要です。",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://byakuyaai.com/demo" },
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const h = await headers();

  // 弾番号(b=5 等)をそのまま client_id に畳む。形式外の値はログを
  // 汚さないよう demo_direct に落とす(n8n 側検証にも合わせる)。
  const batch = b && /^[a-z0-9]{1,8}$/i.test(b) ? b.toLowerCase() : "";
  const clientId = batch ? `demo_b${batch}` : "demo_direct";

  after(
    fetch(
      `${LOG_URL}?${new URLSearchParams({
        c: clientId,
        d: "hp",
        r: h.get("referer") ?? "",
        matched: "1",
      })}`,
      { headers: { "user-agent": h.get("user-agent") ?? "" } }
    ).catch(() => {})
  );

  return (
    <main className="flex-1 bg-[var(--brand-cream)]">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-8 sm:py-12">
        {/* 最小ヘッダー(戻り先は総合LP) */}
        <p className="text-center text-sm font-black tracking-widest text-[var(--brand-ink)]">
          ByakuyaAI
        </p>

        <h1 className="mt-5 text-center text-xl font-bold leading-snug text-[var(--brand-ink)] sm:text-2xl">
          AIが作った&quot;実物&quot;を
          <br className="sm:hidden" />
          50秒でご覧ください
        </h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-[var(--brand-gray)]">
          実際にお客様へ納品した動画です(お客様名のみ「貴社名」に差し替え)
        </p>

        {/* 動画 — このページの主役。ファーストビューに必ず入れる */}
        <div className="mx-auto mt-6 w-full max-w-[300px]">
          <div className="overflow-hidden rounded-[2rem] border-[6px] border-[var(--brand-ink)] bg-black shadow-2xl shadow-black/20">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- 納品動画のデモ再生(テロップ焼き込み済) */}
            <video
              src="/works/sample-tour.mp4"
              poster="/works/sample-tour-poster.jpg"
              controls
              playsInline
              preload="metadata"
              className="block h-auto w-full"
            />
          </div>
          <p className="mt-2 text-center text-[10px] leading-relaxed text-[var(--brand-gray-light)]">
            ※ 物件情報は制作時点のもの・照明等の演出はイメージです
          </p>
        </div>

        {/* オファー再掲 — 文面Bと同じ言葉で受ける */}
        <div className="mt-8 rounded-2xl border border-[var(--brand-border)] bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-[var(--brand-ink)]">
            今月は先着5社様限定・無料お試し期間をご案内中です
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--brand-gray)]">
            期間中は貴社の物件で、動画の仕上がりと反響を費用ゼロでお確かめいただけます。
            お送りしたメッセージに「見てみたい」と一言ご返信いただくか、
            下記までご連絡ください。撮影・出演・打ち合わせは不要です。
          </p>
          <a
            href="mailto:info@byakuyaai.com?subject=%E7%84%A1%E6%96%99%E5%88%B6%E4%BD%9C%E3%82%92%E8%A6%8B%E3%81%A6%E3%81%BF%E3%81%9F%E3%81%84"
            className="mt-4 inline-block rounded-full bg-[var(--brand-orange)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
          >
            「見てみたい」とメールする
          </a>
          <p className="mt-2 text-[11px] text-[var(--brand-gray-light)]">
            info@byakuyaai.com / 費用はかかりません
          </p>
        </div>

        {/* 提案資料(1枚PDF)— 料金・お試しパックの中身はここで開示する */}
        <p className="mt-6 text-center">
          <a
            href="/proposal.pdf"
            target="_blank"
            rel="noopener"
            className="inline-block rounded-full border border-[var(--brand-orange-dark)] px-5 py-2.5 text-xs font-bold text-[var(--brand-orange-dark)] transition hover:bg-[var(--brand-orange)] hover:text-white"
          >
            料金とサービス資料を見る(PDF・1枚)
          </a>
        </p>

        {/* サービス全体へ(任意導線) */}
        <p className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-[var(--brand-orange-dark)] underline underline-offset-2"
          >
            サービスの詳細を見る →
          </Link>
        </p>

        <footer className="mt-auto pt-10 text-center text-[10px] text-[var(--brand-gray-light)]">
          <p>ByakuyaAI(ビャクヤエーアイ)</p>
          <p className="mt-1">
            <Link href="/tokushoho" className="underline underline-offset-2">
              特定商取引法に基づく表記
            </Link>
            <span className="mx-2">/</span>
            <Link href="/privacy" className="underline underline-offset-2">
              プライバシーポリシー
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
