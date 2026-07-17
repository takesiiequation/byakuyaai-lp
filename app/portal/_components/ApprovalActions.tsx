"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// pending_approval行の「✅ 投稿を承認」「却下」「確認・修正する」クラスタ。
// 承認/却下は押下時に window.confirm で意思確認してから
// /api/portal/approval/action を叩く(実体は承認メールの<form>と同じ n8n
// webhookを叩いているだけ — app/_lib/approvalAction.ts参照)。
//
// 成功後は「処理中…」固定表示に切り替える(制作状況シートへの反映は
// n8n側のcronが投稿予約時刻に実行するため即時ではない — サーバー側の
// 状態を待たず、クライアント側だけでこの行の再操作を止める設計)。
// router.refresh() も呼ぶが、承認直後は 制作状況.status がまだ
// "pending_approval" のままな場合があるため(cron到達まで)、必ずしも
// バッジ側が即座に切り替わるとは限らない — その場合でもこのコンポーネント
// 自身の内部stateがボタンの再表示を防ぐ。
export default function ApprovalActions({
  approvalId,
  propertyName,
}: {
  approvalId: string;
  propertyName: string;
}) {
  const [status, setStatus] = useState<
    "idle" | "approving" | "rejecting" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const busy = status === "approving" || status === "rejecting";
  const label = propertyName || "この動画";

  async function run(action: "approve" | "reject") {
    const confirmMsg =
      action === "approve"
        ? `「${label}」を投稿してよろしいですか？\nこの操作は取り消せません。`
        : `「${label}」を却下しますか？`;
    if (!window.confirm(confirmMsg)) return;

    setStatus(action === "approve" ? "approving" : "rejecting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/portal/approval/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId, action }),
      });
      const data: { ok?: boolean; error?: string; message?: string } = await res
        .json()
        .catch(() => ({}));
      if (data?.ok) {
        setStatus("done");
        router.refresh();
      } else {
        setStatus("error");
        setErrorMsg(data?.error || "処理に失敗しました");
      }
    } catch {
      setStatus("error");
      setErrorMsg("通信に失敗しました。時間をおいて再度お試しください");
    }
  }

  if (status === "done") {
    return (
      <span className="text-xs text-[var(--brand-gray-light)]">処理中…</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={busy}
          className="inline-block bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {status === "approving" ? "処理中…" : "✅ 投稿を承認"}
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={busy}
          className="inline-block bg-gray-100 text-gray-500 font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm border border-gray-200 hover:bg-gray-200 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {status === "rejecting" ? "処理中…" : "却下"}
        </button>
        <a
          href={`/revise/${approvalId}`}
          aria-disabled={busy}
          className={`inline-block bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm transition-all active:scale-[0.98] ${
            busy ? "pointer-events-none opacity-50" : "hover:shadow-lg"
          }`}
        >
          確認・修正する
        </a>
      </div>
      {status === "error" && (
        <p className="max-w-[240px] text-right text-[11px] text-red-600">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
