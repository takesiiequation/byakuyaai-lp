import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { quotaState } from "@/app/_lib/portalSubmit";
import { quotaSummary } from "@/app/_lib/quota";
import { Shell, MessageCard } from "../_components/Shell";
import SubmitForm from "../_components/SubmitForm";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";

// /portal/submit — 動画生成依頼フォーム(Googleフォーム卒業の入口)。
// 認証+portal_enabled 再検証は /portal ダッシュボードと同一の流儀。
// クォータ超過/未設定はフォームを出さずにメッセージカードで止める
// (n8n側の正式拒否に到達する前のUX抑止・罠(4)-5)。

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "動画作成を依頼",
  robots: { index: false, follow: false },
};

export default async function PortalSubmitPage() {
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  const client = await getClientById(clientId);
  if (!client || !isFlagOn(client.portal_enabled)) {
    return (
      <Shell>
        <MessageCard
          title="マイページをご利用いただけません"
          body="お手数ですが担当者までご連絡ください。"
        />
      </Shell>
    );
  }

  const qs = quotaState(client);
  // v3.2(2026-07-22・PCレイアウト対応): 入稿画面はlg+で2カラムフォームに
  // なるため、他のportalページ(ダッシュボード等)を巻き込まずこのページ
  // だけ横幅を広げる(Shell.tsxのmaxWidthClassName override)。
  // v3.3(2026-07-23・PC幅活用): xl+でさらに拡大(lg:max-w-5xl→
  // xl:max-w-7xl)。2カラムの比率調整(左カラムの間延び防止)は
  // SubmitForm.tsx側のgrid-cols定義で対応(xl:専用のcolumn定義)。
  // reset-aware な数字(quota.ts と統一)— client.used_this_month の生値を
  // そのまま出すと、判定は「もう投稿できる」なのに表示が「上限到達」に見える
  // ズレが起き得る(quota_reset を過ぎたがシートの used_this_month が
  // まだ n8n の月初cronで物理リセットされていない期間)。
  const qsummary = quotaSummary(client);

  return (
    <Shell maxWidthClassName="max-w-lg lg:max-w-5xl xl:max-w-7xl">
      <div className="mb-6">
        <a
          href="/portal"
          className="text-xs text-[var(--brand-gray-light)] hover:text-[var(--brand-ink)] transition-colors"
        >
          ← マイページへ戻る
        </a>
        <h1 className="mt-2 text-lg sm:text-xl font-bold text-[var(--brand-ink)]">
          新しい動画を作る
        </h1>
        <p className="text-xs text-[var(--brand-gray-light)] mt-0.5">
          マイソクと写真をアップロードするだけで、AIがショート動画を自動生成します
        </p>
      </div>

      {qs === "not_configured" ? (
        <MessageCard
          title="ご利用の準備が整っていません"
          body="動画作成の上限が未設定です。お手数ですが担当者までご連絡ください。"
        />
      ) : qs === "exceeded" ? (
        <MessageCard
          title="今月の作成上限に達しています"
          body={`今月のご利用は ${qsummary.used} / ${qsummary.quota} 本です。翌月になると再びご依頼いただけます。`}
        />
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-white/70 border border-black/5 px-4 py-3 text-xs text-[var(--brand-gray)]">
            今月のご利用: {qsummary.used} / {qsummary.quota} 本
          </div>
          <SubmitForm
            defaultEmail={client.notify_email || client.approval_email || ""}
            roomsUiEnabled={process.env.PORTAL_ROOMS_UI === "true"}
          />
        </>
      )}
    </Shell>
  );
}
