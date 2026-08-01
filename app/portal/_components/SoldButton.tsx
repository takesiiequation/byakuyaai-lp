"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 投稿済み/納品済み行の「成約しました」ボタン(2026-08-01 岡本発案)。
// 成約済みにすると、LINEお問い合わせAIがその物件への内見予約等を
// 「成約済みです」とご案内して弾くようになる(SNS投稿の削除はしない)。
// 押し間違い防止に2段階確認。確定で行が「🎉 成約済み」へ変わる。
export default function SoldButton({ execId }: { execId: string }) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "busy">("idle");
  const router = useRouter();

  async function report() {
    setPhase("busy");
    try {
      const res = await fetch("/api/portal/status/sold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exec_id: execId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
    } catch {
      // fail-soft: 通信断でも押し直せる状態に戻すだけ
    }
    setPhase("idle");
  }

  if (phase === "confirm" || phase === "busy") {
    return (
      <div className="text-right">
        <p className="mb-1.5 text-xs text-[var(--brand-gray)]">
          お問い合わせがあった際に「成約済み」とご案内するようになります
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPhase("idle")}
            disabled={phase === "busy"}
            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-[var(--brand-gray)] transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={report}
            disabled={phase === "busy"}
            className="rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-3 py-2 text-xs font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {phase === "busy" ? "送信中…" : "確定する"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("confirm")}
      className="rounded-xl border border-[var(--brand-orange)]/40 px-3 py-2 text-xs font-semibold text-[var(--brand-orange-dark)] transition-all hover:bg-orange-50 active:scale-[0.98]"
    >
      🎉 成約しました
    </button>
  );
}
