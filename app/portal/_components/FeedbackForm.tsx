"use client";

import { useState } from "react";

// /portal/feedback の本体フォーム。認証・シート書き込みはサーバー側
// (app/api/portal/feedback/route.ts)が担当 — ここは入力UI+送信のみ。
// 送信後はフォームをサンクス表示に置き換える(ApprovalActionsのdone
// state表示パターンを踏襲・再送信の動線はあえて出さない=1回の気軽な
// 投稿を促す設計)。

const SCORE_OPTIONS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: "😞", label: "不満" },
  { value: 2, emoji: "😕", label: "やや不満" },
  { value: 3, emoji: "😐", label: "ふつう" },
  { value: 4, emoji: "🙂", label: "満足" },
  { value: 5, emoji: "😍", label: "とても満足" },
];

const CATEGORIES = ["使いやすさ", "動画の仕上がり", "修正のしやすさ", "その他"];

const MAX_BODY_LENGTH = 1000;

type Phase = "idle" | "sending" | "done" | "error";

export default function FeedbackForm() {
  const [score, setScore] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!score) {
      setErrorMsg("満足度を選択してください");
      return;
    }
    setPhase("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/portal/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          category: category || "",
          body: body.trim(),
          page: "/portal/feedback",
        }),
      });
      const data: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (data?.ok) {
        setPhase("done");
      } else {
        setPhase("error");
        setErrorMsg(data?.error || "送信に失敗しました。時間をおいて再度お試しください");
      }
    } catch {
      setPhase("error");
      setErrorMsg("通信に失敗しました。時間をおいて再度お試しください");
    }
  }

  if (phase === "done") {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
        <p aria-hidden className="mb-2 text-3xl">
          🙏
        </p>
        <h2 className="text-base font-bold text-[var(--brand-ink)] sm:text-lg">
          ありがとうございます
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--brand-gray)]">
          いただいた声はすべて拝見し、改善に活かします
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
    >
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-semibold text-[var(--brand-ink)]">
          総合的な満足度<span className="ml-1 text-red-500">*</span>
        </legend>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {SCORE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScore(opt.value)}
              aria-pressed={score === opt.value}
              className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-3 transition-all active:scale-[0.97] ${
                score === opt.value
                  ? "border-[var(--brand-orange)] bg-[var(--brand-cream-2)] shadow-sm"
                  : "border-[var(--brand-border)] bg-white hover:border-[var(--brand-orange-light)]"
              }`}
            >
              <span aria-hidden className="text-2xl sm:text-3xl">
                {opt.emoji}
              </span>
              <span className="text-[10px] font-medium text-[var(--brand-gray)] sm:text-[11px]">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-semibold text-[var(--brand-ink)]">
          カテゴリ(任意)
        </legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory((cur) => (cur === c ? null : c))}
              aria-pressed={category === c}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
                category === c
                  ? "border-[var(--brand-orange)] bg-[var(--brand-orange)] text-white"
                  : "border-[var(--brand-border)] bg-white text-[var(--brand-gray)] hover:border-[var(--brand-orange-light)]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mb-6">
        <label
          htmlFor="feedback-body"
          className="mb-2 block text-sm font-semibold text-[var(--brand-ink)]"
        >
          ご自由にお書きください(任意)
        </label>
        <textarea
          id="feedback-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY_LENGTH))}
          maxLength={MAX_BODY_LENGTH}
          rows={5}
          placeholder="気になったこと、こうだったら嬉しい、どんなことでもお書きください"
          className="w-full rounded-xl border border-[var(--brand-border)] bg-white px-3 py-2.5 text-sm text-[var(--brand-ink)] placeholder:text-[var(--brand-gray-light)] focus:border-[var(--brand-orange)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-orange)]"
        />
        <p className="mt-1 text-right text-[11px] text-[var(--brand-gray-light)]">
          {body.length} / {MAX_BODY_LENGTH}
        </p>
      </div>

      {errorMsg && <p className="mb-4 text-xs text-red-600">{errorMsg}</p>}

      <button
        type="submit"
        disabled={phase === "sending" || !score}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-4 py-3 text-sm font-bold text-white transition-all hover:shadow-lg active:scale-[0.98] disabled:opacity-50 sm:text-base"
      >
        {phase === "sending" ? "送信中…" : "送信する"}
      </button>
    </form>
  );
}
