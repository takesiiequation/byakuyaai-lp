import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { after } from "next/server";
import { headers } from "next/headers";

/* ============================================================
 * /monitor — モニタープラン(県西エリア限定・月額3万円)の着地ページ
 *
 * 印刷チラシ(public/monitor/flyer.png)右下のQRコードの飛び先。
 * /demo の派生: 「開いた瞬間に動画・1タップで再生」を踏襲し、
 * オファー部分だけモニタープランの内容(月3万・月10本・先着10社)に差し替え。
 * チラシ本体と PDF(/monitor.pdf)もここから見られる=「提案資料が見られる場所」。
 *
 * 計測: 既存のリンク計測基盤(n8n link-click → 契約社スプシ「リンククリック」)へ
 * c=monitor_qr で記録。このページへの導線はQRと直リンクだけなので、
 * ページ閲覧数 ≒ QR読み取り数 として扱える。
 *
 * SEO: 営業着地専用のため noindex。
 * ============================================================ */

const LOG_URL = "https://aiboost-takeshi.app.n8n.cloud/webhook/link-click";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "モニタープラン — 月額3万円で物件のSNS動画を月10本",
  description:
    "スマホで撮った物件動画が、プロ品質のSNSショート動画になります。県西エリア限定・先着10社のモニタープラン。",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://byakuyaai.com/monitor" },
};

export default async function MonitorPage() {
  const h = await headers();

  after(
    fetch(
      `${LOG_URL}?${new URLSearchParams({
        c: "monitor_qr",
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
        <p className="text-center text-sm font-black tracking-widest text-[var(--brand-ink)]">
          ByakuyaAI
        </p>
        <p className="mt-2 text-center text-[11px] font-bold tracking-wide text-[var(--brand-orange-dark)]">
          県西エリア限定・先着10社 モニタープラン
        </p>

        <h1 className="mt-4 text-center text-xl font-bold leading-snug text-[var(--brand-ink)] sm:text-2xl">
          スマホで撮った物件動画が、
          <br />
          プロ品質のSNS動画になります
        </h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-[var(--brand-gray)]">
          実際にお客様へ納品した動画です(50秒・お客様名のみ「貴社名」に差し替え)
        </p>

        {/* 動画 — ファーストビューに必ず入れる */}
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

        {/* オファー — チラシと同じ言葉で受ける */}
        <div className="mt-8 rounded-2xl border border-[var(--brand-border)] bg-white p-5 text-center shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-[var(--brand-gray)]">
            モニタープラン(税別)
          </p>
          <p className="mt-1 text-2xl font-black text-[var(--brand-ink)]">
            月額 3万円
            <span className="ml-2 text-sm font-bold text-[var(--brand-orange-dark)]">
              ショート動画 月10本
            </span>
          </p>
          <ul className="mx-auto mt-3 max-w-xs space-y-1 text-left text-xs leading-relaxed text-[var(--brand-gray)]">
            <li>・撮影はスマホでOK。編集・テロップ・ナレーション・音楽はすべてお任せ</li>
            <li>・Instagram・TikTokへの投稿まで代行。専用ページで確認・修正できます</li>
            <li>・7ヶ月目以降は創業価格 月5万円で上位プランへ移行(終了も可・縛りなし)</li>
          </ul>
          <a
            href="tel:08062609731"
            className="mt-5 inline-block rounded-full bg-[var(--brand-orange)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
          >
            電話で相談する 080-6260-9731
          </a>
          <p className="mt-3 text-xs text-[var(--brand-gray)]">
            メールなら
            <a
              href="mailto:info@byakuyaai.com?subject=%E3%83%A2%E3%83%8B%E3%82%BF%E3%83%BC%E3%83%97%E3%83%A9%E3%83%B3%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6"
              className="ml-1 font-semibold text-[var(--brand-orange-dark)] underline underline-offset-2"
            >
              info@byakuyaai.com
            </a>
          </p>
          <p className="mt-2 text-[11px] text-[var(--brand-gray-light)]">
            モニター価格は、導入事例とご意見をご提供いただく代わりの実証プログラム価格です
          </p>
        </div>

        {/* チラシ本体(印刷物と同じもの)+ PDF */}
        <div className="mt-8">
          <p className="mb-2 text-center text-[11px] font-bold tracking-wide text-[var(--brand-gray)]">
            ご案内チラシ
          </p>
          <div className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white shadow-sm">
            <Image
              src="/monitor/flyer.png"
              alt="ByakuyaAI モニタープラン ご案内チラシ(月額3万円・月10本・県西エリア限定先着10社)"
              width={1024}
              height={1536}
              className="block h-auto w-full"
              priority={false}
            />
          </div>
          <p className="mt-3 text-center">
            <a
              href="/monitor.pdf"
              target="_blank"
              rel="noopener"
              className="inline-block rounded-full border border-[var(--brand-orange-dark)] px-5 py-2.5 text-xs font-bold text-[var(--brand-orange-dark)] transition hover:bg-[var(--brand-orange)] hover:text-white"
            >
              チラシをPDFで開く
            </a>
          </p>
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs font-semibold text-[var(--brand-orange-dark)] underline underline-offset-2"
          >
            サービスの詳細を見る →
          </Link>
        </p>

        <footer className="mt-auto pt-10 text-center text-[10px] text-[var(--brand-gray-light)]">
          <p>ByakuyaAI(ビャクヤエーアイ)</p>
          <p className="mt-1">表示価格は税別です。集客効果等の成果を保証するものではありません。</p>
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
