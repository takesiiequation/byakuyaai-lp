"use client";

import { useMemo, useState } from "react";
import type { ReviseTelop } from "@/app/_lib/revise";

const MAX_TEXT_LEN = 120;
const MAX_CAPTION_LEN = 2200;

export default function ReviseForm({
  approvalId,
  propertyName,
  clientName,
  videoUrl,
  telops,
  caption,
}: {
  approvalId: string;
  propertyName: string;
  clientName: string;
  videoUrl: string;
  telops: ReviseTelop[];
  caption: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(telops.map((t) => [t.role, t.text]))
  );
  const [captionValue, setCaptionValue] = useState(caption);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [doneKind, setDoneKind] = useState<"video" | "caption">("video");

  const changed = useMemo(
    () =>
      telops
        .filter((t) => (values[t.role] ?? "").trim() !== t.text.trim())
        .map((t) => ({ role: t.role, new_text: (values[t.role] ?? "").trim() })),
    [telops, values]
  );

  const hasEmptyChange = changed.some((c) => c.new_text.length === 0);

  const captionTrimmed = captionValue.trim();
  const captionChanged = captionTrimmed !== caption.trim();
  const captionEmptyInvalid = captionChanged && captionTrimmed.length === 0;

  const canSubmit =
    (changed.length > 0 || captionChanged) &&
    !hasEmptyChange &&
    !captionEmptyInvalid &&
    !submitting;

  const previewItems = useMemo(() => {
    const items = changed.map((c) => {
      const t = telops.find((x) => x.role === c.role);
      return { key: c.role, label: t?.label ?? c.role, text: c.new_text };
    });
    if (captionChanged && !captionEmptyInvalid) {
      items.push({
        key: "__caption__",
        label: "投稿キャプション",
        text: captionTrimmed,
      });
    }
    return items;
  }, [changed, telops, captionChanged, captionEmptyInvalid, captionTrimmed]);

  function updateValue(role: string, next: string) {
    setValues((v) => ({ ...v, [role]: next.slice(0, MAX_TEXT_LEN) }));
  }

  function updateCaption(next: string) {
    setCaptionValue(next.slice(0, MAX_CAPTION_LEN));
  }

  async function handleConfirmSend() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const body: Record<string, unknown> = { approvalId, edits: changed };
      if (captionChanged && !captionEmptyInvalid) {
        body.caption_edit = captionTrimmed;
      }
      const res = await fetch("/api/revise/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setDoneKind(changed.length > 0 ? "video" : "caption");
        setDone(true);
        setShowConfirm(false);
      } else {
        setSubmitError(
          "送信に失敗しました。時間をおいて再度お試しください。"
        );
      }
    } catch {
      setSubmitError("送信に失敗しました。時間をおいて再度お試しください。");
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
        <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-cream-2)] text-2xl">
          ✓
        </div>
        <h1 className="text-lg font-black text-[var(--brand-ink)] sm:text-xl">
          {doneKind === "caption"
            ? "キャプションを更新しました"
            : "修正を受け付けました"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)]">
          {doneKind === "caption"
            ? "投稿時に反映されます。"
            : "数分で動画を作り直し、確認メールをお送りします。"}
        </p>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[380px_1fr] lg:items-start lg:gap-8">
      {/* Left column: video preview, pinned in place on desktop */}
      <div className="lg:sticky lg:top-20">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
          <div className="brand-accent-bar mb-4 h-1 w-16 rounded-full" />
          <h1 className="text-lg font-black text-[var(--brand-ink)] sm:text-xl">
            動画テロップの修正
          </h1>
          {propertyName && (
            <p className="mt-1.5 text-sm font-bold text-[var(--brand-gray)]">
              {propertyName}
            </p>
          )}
          {clientName && (
            <p className="mt-0.5 text-xs text-[var(--brand-gray-light)]">
              {clientName} 様
            </p>
          )}

          {videoUrl && (
            <div className="mx-auto mt-5 w-full max-w-[260px] lg:max-w-none lg:flex lg:justify-center">
              <video
                controls
                playsInline
                src={videoUrl}
                className="aspect-[9/16] w-full rounded-xl bg-black object-cover lg:h-auto lg:w-auto lg:max-w-full lg:max-h-[80vh]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right column: telop + caption editing, scrolls independently */}
      <div className="mt-5 space-y-5 lg:mt-0">
        <div className="space-y-3">
          {telops.map((t) => {
            const val = values[t.role] ?? "";
            const isChanged = val.trim() !== t.text.trim();
            return (
              <div
                key={t.role}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-colors sm:p-5 ${
                  isChanged ? "ring-[var(--brand-orange)]" : "ring-black/5"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-gray-light)]">
                    {t.label}
                  </span>
                  {isChanged && (
                    <span className="rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
                      変更あり
                    </span>
                  )}
                </div>
                <textarea
                  value={val}
                  onChange={(e) => updateValue(t.role, e.target.value)}
                  maxLength={MAX_TEXT_LEN}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-3 py-2.5 text-sm text-[var(--brand-ink)] focus:border-[var(--brand-orange)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/30"
                />
                <div className="mt-1 text-right text-[11px] text-[var(--brand-gray-light)]">
                  {val.length} / {MAX_TEXT_LEN}
                </div>
              </div>
            );
          })}
        </div>

        {caption && (
          <div
            className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-colors sm:p-5 ${
              captionChanged ? "ring-[var(--brand-orange)]" : "ring-black/5"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-gray-light)]">
                投稿キャプション
              </span>
              {captionChanged && (
                <span className="rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
                  変更あり
                </span>
              )}
            </div>
            <textarea
              value={captionValue}
              onChange={(e) => updateCaption(e.target.value)}
              maxLength={MAX_CAPTION_LEN}
              rows={4}
              className="w-full resize-none rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-3 py-2.5 text-sm text-[var(--brand-ink)] focus:border-[var(--brand-orange)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/30"
            />
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-red-500">
                {captionEmptyInvalid && "キャプションを入力してください"}
              </span>
              <span className="text-[var(--brand-gray-light)]">
                {captionValue.length} / {MAX_CAPTION_LEN}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-[var(--brand-gray-light)]">
              ※キャプションのみの修正は動画を作り直さず、投稿時にそのまま反映されます
            </p>
          </div>
        )}

        <div className="rounded-2xl bg-[var(--brand-cream)] p-4 text-[11px] leading-relaxed text-[var(--brand-gray)] sm:text-xs">
          <p>
            ※読み仮名の都合で、画面上の表記と動画内の表示が一部異なる場合があります
          </p>
          <p className="mt-1.5">
            ※家賃や間取りなどの物件情報の変更はできません。資料の修正が必要な場合はご担当までご連絡ください
          </p>
        </div>

        {submitError && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {submitError}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setShowConfirm(true)}
          className="w-full rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          この内容で修正を依頼する
        </button>
        {changed.length === 0 && !captionChanged && (
          <p className="text-center text-xs text-[var(--brand-gray-light)]">
            テキストを変更すると送信できます
          </p>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <h2 className="text-base font-black text-[var(--brand-ink)]">
              この内容で修正を依頼しますか?
            </h2>
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {previewItems.map((item) => (
                <li
                  key={item.key}
                  className="rounded-lg bg-[var(--brand-cream)] p-2.5"
                >
                  <div className="text-[11px] font-bold text-[var(--brand-gray-light)]">
                    {item.label}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[var(--brand-ink)]">
                    {item.text}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-[var(--brand-gray)] transition-colors hover:bg-gray-100 disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={submitting}
                className="flex-1 rounded-xl bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {submitting ? "送信中..." : "依頼する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
