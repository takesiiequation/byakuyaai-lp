"use client";

import { useState } from "react";

// 動画の違和感報告(2026-08-06 岡本発案)。修正画面の動画プレビュー直下に
// 小さな入口を置き、「つかみがひらがなになっている」「0:07で暗転する」の
// ような気づきを一言で送ってもらう — 担当者が丁寧なお問い合わせメールを
// 書く手間を無くすのが目的(小濱さんの実例2件が発端)。
// 送信先: /api/revise/report → フィードバックタブ記録+Discord通知。
export default function ReportIssueBox({ approvalId }: { approvalId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function send() {
    const body = text.trim();
    if (!body) return;
    setState("busy");
    try {
      const res = await fetch("/api/revise/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_id: approvalId, body }),
      });
      if (res.ok) {
        setState("done");
        return;
      }
    } catch {
      // fail-soft: 下のsetStateで再送可能な状態に戻す
    }
    setState("error");
  }

  if (state === "done") {
    return (
      <p className="mx-auto mt-3 max-w-[260px] text-center text-xs leading-relaxed text-[var(--brand-gray)] lg:max-w-none">
        ご報告ありがとうございます。担当者が確認し、必要に応じてご連絡いたします。
      </p>
    );
  }

  if (!open) {
    return (
      <p className="mx-auto mt-3 max-w-[260px] text-center lg:max-w-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[11px] text-[var(--brand-gray-light)] underline decoration-dotted underline-offset-2 hover:text-[var(--brand-orange-dark)]"
        >
          ⚠ 動画に不自然な箇所がありましたか？
        </button>
      </p>
    );
  }

  return (
    <div className="mx-auto mt-3 w-full max-w-[300px] rounded-xl border border-black/10 bg-white/80 p-3 lg:max-w-[340px]">
      <p className="text-xs font-semibold text-[var(--brand-ink)]">
        気になった箇所を教えてください
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="例: 0:07あたりで画面が一瞬暗くなる / つかみの文字がひらがなになっている"
        className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
      />
      {state === "error" && (
        <p className="mt-1 text-[11px] font-semibold text-red-600">
          送信に失敗しました。時間をおいてお試しください。
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={state === "busy"}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[var(--brand-gray)] hover:bg-gray-50 disabled:opacity-50"
        >
          閉じる
        </button>
        <button
          type="button"
          onClick={send}
          disabled={state === "busy" || !text.trim()}
          className="rounded-lg bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-3 py-1.5 text-xs font-semibold text-white hover:shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {state === "busy" ? "送信中…" : "報告する"}
        </button>
      </div>
    </div>
  );
}
