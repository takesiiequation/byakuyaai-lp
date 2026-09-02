import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getReviseInfo } from "@/app/_lib/revise";
import ReviseForm from "../_components/ReviseForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "動画テロップの確認・編集",
  robots: { index: false, follow: false },
};

function Shell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const maxWidth = wide ? "max-w-lg lg:max-w-[1700px]" : "max-w-lg";
  const padX = wide ? "px-4 sm:px-6 lg:px-8" : "px-4 sm:px-6";
  return (
    <main className="min-h-screen bg-[var(--brand-cream)]">
      <header className="sticky top-0 z-30 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
        {/* 2026-07-27 岡本指摘「ロゴが左上に来てない」の根治: 内側divに
            mx-auto+maxWidth を掛けるとPC幅ではロゴが中央寄せ列の左端=画面
            中央付近に浮く。ポータル側Shell(app/portal/_components/Shell.tsx)
            と同じ全幅コンテナにしてロゴを常にビューポート左上へ。 */}
        <div className="flex h-14 items-center px-4 sm:px-6">
          {/* 2026-07-15 岡本要望: ロゴクリックでマイページへ戻れるように
              (未ログインなら /portal が /portal/login へリダイレクトするので問題ない) */}
          <Link href="/portal" aria-label="マイページへ戻る">
            <Image
              src="/logo.png"
              alt="ByakuyaAI"
              width={120}
              height={36}
              className="h-7 w-auto"
            />
          </Link>
        </div>
      </header>
      <div className={`mx-auto py-6 sm:py-10 ${padX} ${maxWidth}`}>
        {children}
      </div>
      <p className="pb-8 text-center text-xs text-[var(--brand-gray-light)]">
        © 2026 ByakuyaAI. All rights reserved.
      </p>
    </main>
  );
}

// 完全ロック時の文言分岐(2026-07-27 岡本要望): info.status によって
// ロックの理由が異なるため、一律の「投稿処理中または投稿済み」ではなく
// 理由が伝わる文言に出し分ける。
//  ・pending なのに editable/caption_editable が両方falseになるのは
//    修正期限(14日間)超過のケースのみ(posted/processing中ならまず
//    statusがpendingではなくなっている)。
//  ・rejected は却下済みである旨を明示。
//  ・それ以外(posted/processing等)は従来通りの汎用文言のまま。
function lockedMessage(status: string | undefined): {
  title: string;
  body: string;
} {
  if (status === "pending") {
    return {
      title: "編集期限を過ぎています",
      body: "この動画の編集期限(14日間)を過ぎたため編集できません。編集をご希望の場合は、お手数ですがご担当者までご連絡ください。",
    };
  }
  if (status === "rejected") {
    return {
      title: "この動画は編集できません",
      body: "この動画は却下済みのため編集できません。",
    };
  }
  return {
    title: "この動画は編集できません",
    body: "この動画は現在編集できません(投稿処理中または投稿済み)。",
  };
}

function MessageCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
      <h1 className="text-lg font-black text-[var(--brand-ink)] sm:text-xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)]">
        {body}
      </p>
    </div>
  );
}

// 修正期限の赤字表示(2026-07-27 岡本要望「残り何日かを赤字で表示させてあげる」)。
// deadline は編集情報APIが期限判定に使う値そのもの(created_at+14日)なので、
// ここで独自計算はしない — 表示と判定がズレる事故を構造的に防ぐ。
// 旧応答に deadline が無い場合は何も出さない(表示だけの機能なのでfail-soft)。
function DeadlineNotice({ deadline }: { deadline?: string }) {
  if (!deadline) return null;
  const t = new Date(deadline).getTime();
  if (isNaN(t)) return null;
  const remainMs = t - Date.now();
  if (remainMs <= 0) return null; // 期限切れはロック分岐が先に出るので通常来ない
  const daysLeft = Math.ceil(remainMs / 86400000);
  const dateLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(deadline));
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
      編集期限: {dateLabel} まで(残り{daysLeft}日)
      {daysLeft <= 2 && (
        <span className="ml-1 font-semibold">— お早めにお願いいたします</span>
      )}
    </div>
  );
}

export default async function RevisePage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const info = await getReviseInfo(approvalId);

  if (!info.ok) {
    return (
      <Shell>
        <MessageCard
          title="ページを表示できませんでした"
          body="お手数ですがご担当までご連絡ください。"
        />
      </Shell>
    );
  }

  // Fully locked: neither video-affecting edits nor caption edits are
  // allowed (posted/processing/rejected, or past the 6-day deadline).
  if (!info.editable && !info.caption_editable) {
    const { title, body } = lockedMessage(info.status);
    return (
      <Shell>
        <MessageCard title={title} body={body} />
      </Shell>
    );
  }

  return (
    <Shell wide>
      <DeadlineNotice deadline={info.deadline} />
      <ReviseForm
        approvalId={approvalId}
        propertyName={info.property_name ?? ""}
        clientName={info.client_name ?? ""}
        videoUrl={info.video_url ?? ""}
        telops={info.telops ?? []}
        caption={info.caption ?? ""}
        // editable=false here always means caption_editable=true (the fully
        // locked case already returned above) — the 1-revision limit was
        // used, so telop/yomi/swap editing is locked but caption edits
        // still flow through.
        locked={!info.editable}
      />
    </Shell>
  );
}
