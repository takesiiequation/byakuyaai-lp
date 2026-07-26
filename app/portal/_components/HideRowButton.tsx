"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// failed/revise_failed行専用の「×(非表示)」ボタン(2026-07-27 岡本発案:
// 「失敗しましたの欄が何個もあって邪魔、消せるようにできない?」)。
// /api/portal/status/hide にexec_idをPOSTし、シート側I列(hidden)に
// 'true'が立ったら router.refresh() で一覧を再取得する(データそのものは
// 消えない — 監査用にシート上には行が残る)。確認ダイアログは不要。
export default function HideRowButton({ execId }: { execId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function hide() {
    setBusy(true);
    try {
      const res = await fetch("/api/portal/status/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exec_id: execId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
    } catch {
      // fail-soft: 失敗時はボタンを再度押し直せるようbusyを戻すだけ
      // (通信断/一時的なシート障害でも顧客体験を壊さない)。
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={hide}
      disabled={busy}
      aria-label="この行を非表示にする"
      title="この行を非表示にする"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--brand-gray-light)] transition-colors hover:bg-gray-100 hover:text-[var(--brand-gray)] disabled:opacity-50"
    >
      ×
    </button>
  );
}
