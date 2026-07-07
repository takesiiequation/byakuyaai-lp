"use client";

import { useMemo, useState } from "react";
import {
  MAX_CAPTION_LEN,
  MAX_TEXT_LEN,
  MAX_YOMI_LEN,
  YOMI_RE,
  type ReviseTelop,
} from "@/app/_lib/revise";

/** Telop text now allows newlines through as typed — a newline renders as a
 * fixed line break at that position in the video. Only leading/trailing
 * whitespace is trimmed before comparing/sending. */
function sanitizeTelop(s: string): string {
  return s.trim();
}

function sanitizeYomi(s: string): string {
  return s.trim();
}

/** Returns an error message if the (already-trimmed) reading script is
 * invalid, null if valid. The box is prefilled with the full current
 * script, so — unlike the old word-level reading hint — an empty value here
 * means the customer erased the whole script, not "no override"; that's
 * treated as an error rather than silently ignored. Kanji/CJK is allowed
 * (this is a script rewrite, not a phonetic-only hint); only control
 * characters, HTML-tag-like brackets, and emoji are rejected. */
function yomiError(trimmed: string): string | null {
  if (trimmed.length === 0) return "読み上げ台本を入力してください";
  if (trimmed.length > MAX_YOMI_LEN) {
    return `${MAX_YOMI_LEN}字以内で入力してください`;
  }
  if (!YOMI_RE.test(trimmed)) {
    return "使用できない文字が含まれています(絵文字・制御文字・記号タグは使用できません)";
  }
  return null;
}

/** Grows a textarea to fit its content instead of scrolling internally. */
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function telopCounterClass(len: number) {
  if (len >= MAX_TEXT_LEN) return "text-red-500";
  if (len > 25) return "text-amber-500";
  return "text-[var(--brand-gray-light)]";
}

export default function ReviseForm({
  approvalId,
  propertyName,
  clientName,
  videoUrl,
  telops,
  caption,
  locked = false,
}: {
  approvalId: string;
  propertyName: string;
  clientName: string;
  videoUrl: string;
  telops: ReviseTelop[];
  caption: string;
  /** True when the 1-revision-per-video limit has already been used: telop
   * text, reading script, and still-image swap are all non-interactive, but
   * the caption box below stays fully editable. */
  locked?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(telops.map((t) => [t.role, t.text]))
  );
  // Prefilled with the current narration script (not blank) — opening the
  // box shows the full script so the customer can rewrite just the
  // mispronounced part instead of guessing what "the reading" even is.
  const [yomiValues, setYomiValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(telops.map((t) => [t.role, t.yomi]))
  );
  const [yomiOpen, setYomiOpen] = useState<Record<string, boolean>>({});
  // Still-image swap toggle, per card (role). Only meaningful for cards with
  // a resolvable scene_index that isn't already swapped — those are the
  // only ones that render the toggle in the first place. Swap is one-way:
  // once the backend reports `swapped: true` there's no toggle to turn it
  // back off (see the "差し替え済み" branch below).
  const [swapOn, setSwapOn] = useState<Record<string, boolean>>({});
  const [captionValue, setCaptionValue] = useState(caption);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [doneKind, setDoneKind] = useState<"video" | "caption" | "both">(
    "video"
  );

  // A reading edit only counts once the customer has actually opened the
  // box AND changed it from the prefilled script — if they never opened it,
  // no yomi is sent and the backend auto-converts pronunciation from
  // new_text instead.
  const changed = useMemo(() => {
    // Defense in depth: inputs are already disabled when locked, but force
    // this empty too so a stale/tampered client can't slip telop edits
    // through while the 1-revision limit is in effect.
    if (locked) return [];
    return telops
      .map((t) => {
        const textChanged =
          sanitizeTelop(values[t.role] ?? "") !== t.text.trim();
        const isOpen = yomiOpen[t.role] ?? false;
        const yomiTrimmed = sanitizeYomi(yomiValues[t.role] ?? t.yomi);
        const yomiChangedFromPrefill =
          isOpen && yomiTrimmed !== sanitizeYomi(t.yomi);
        const yomiValid = yomiChangedFromPrefill && !yomiError(yomiTrimmed);
        if (!textChanged && !yomiValid) return null;
        return {
          role: t.role,
          ...(textChanged
            ? { new_text: sanitizeTelop(values[t.role] ?? "") }
            : {}),
          ...(yomiValid ? { yomi: yomiTrimmed } : {}),
        };
      })
      .filter(
        (c): c is { role: string; new_text?: string; yomi?: string } =>
          c !== null
      );
  }, [locked, telops, values, yomiValues, yomiOpen]);

  // Scene_index values queued for still-image swap. Deduped — two cards can
  // resolve to the same underlying scene (e.g. the price-reveal beat reuses
  // the hook clip), and toggling either one should only send it once.
  const swaps = useMemo(() => {
    // Defense in depth, same rationale as `changed` above.
    if (locked) return [];
    return Array.from(
      new Set(
        telops
          .filter(
            (t) =>
              t.scene_index !== null && !t.swapped && (swapOn[t.role] ?? false)
          )
          .map((t) => t.scene_index as number)
      )
    );
  }, [locked, telops, swapOn]);

  const hasEmptyChange = changed.some(
    (c) => c.new_text !== undefined && c.new_text.length === 0
  );

  // Only open boxes can be "invalid" — a closed box always holds the
  // server-provided prefill, which is valid by construction.
  const hasInvalidYomi = telops.some((t) => {
    if (!(yomiOpen[t.role] ?? false)) return false;
    const trimmed = sanitizeYomi(yomiValues[t.role] ?? t.yomi);
    return yomiError(trimmed) !== null;
  });

  const captionTrimmed = captionValue.trim();
  const captionChanged = captionTrimmed !== caption.trim();
  const captionEmptyInvalid = captionChanged && captionTrimmed.length === 0;

  const canSubmit =
    (changed.length > 0 || captionChanged || swaps.length > 0) &&
    !hasEmptyChange &&
    !hasInvalidYomi &&
    !captionEmptyInvalid &&
    !submitting;

  const previewItems = useMemo(() => {
    const items = changed.map((c) => {
      const t = telops.find((x) => x.role === c.role);
      const lines: string[] = [];
      if (c.new_text !== undefined) lines.push(c.new_text);
      if (c.yomi !== undefined) lines.push(`読み上げ台本: ${c.yomi}`);
      return {
        key: c.role,
        label: t?.label ?? c.role,
        text: lines.join("\n"),
      };
    });
    for (const t of telops) {
      if (t.scene_index === null || t.swapped || !(swapOn[t.role] ?? false)) {
        continue;
      }
      items.push({
        key: `swap-${t.role}`,
        label: t.label,
        text: "映像差し替え: 写真のままゆっくり動く表示に変更します",
      });
    }
    if (captionChanged && !captionEmptyInvalid) {
      items.push({
        key: "__caption__",
        label: "投稿キャプション",
        text: captionTrimmed,
      });
    }
    return items;
  }, [
    changed,
    telops,
    swapOn,
    captionChanged,
    captionEmptyInvalid,
    captionTrimmed,
  ]);

  function updateValue(role: string, next: string) {
    setValues((v) => ({ ...v, [role]: next.slice(0, MAX_TEXT_LEN) }));
  }

  function updateYomi(role: string, next: string) {
    setYomiValues((v) => ({ ...v, [role]: next.slice(0, MAX_YOMI_LEN) }));
  }

  function toggleYomi(role: string) {
    setYomiOpen((v) => {
      const closing = v[role] === true;
      if (closing) {
        // 閉じる時、無効な読み台本が残っていたらプリフィル値に戻す
        // (閉じたまま送信不能になる事故防止。空にすると次に開いた時
        // プレースホルダも無いため何も見えなくなるので、プリフィルへ復元する)
        const val = sanitizeYomi(yomiValues[role] ?? "");
        if (yomiError(val)) {
          const t = telops.find((x) => x.role === role);
          setYomiValues((yv) => ({ ...yv, [role]: t?.yomi ?? "" }));
        }
      }
      return { ...v, [role]: !v[role] };
    });
  }

  function updateCaption(next: string) {
    setCaptionValue(next.slice(0, MAX_CAPTION_LEN));
  }

  function toggleSwap(role: string) {
    setSwapOn((v) => ({ ...v, [role]: !v[role] }));
  }

  async function handleConfirmSend() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const body: Record<string, unknown> = { approvalId, edits: changed };
      if (captionChanged && !captionEmptyInvalid) {
        body.caption_edit = captionTrimmed;
      }
      if (swaps.length > 0) {
        body.swaps = swaps;
      }
      const res = await fetch("/api/revise/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        const captionAlsoChanged = captionChanged && !captionEmptyInvalid;
        const hasVideoChange = changed.length > 0 || swaps.length > 0;
        setDoneKind(
          hasVideoChange
            ? captionAlsoChanged
              ? "both"
              : "video"
            : "caption"
        );
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
            : doneKind === "both"
              ? "動画を作り直し、キャプションも更新します。完了後に確認メールをお送りします。"
              : "数分で動画を作り直し、確認メールをお送りします。"}
        </p>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      {/* Left column: video preview, pinned in place and sized to the
          viewport on desktop (height drives width via the 9:16 ratio) */}
      <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-8rem)] lg:flex lg:justify-center">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6 lg:flex lg:h-full lg:flex-col">
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
            <div className="mx-auto mt-5 w-full max-w-[260px] lg:mt-4 lg:flex lg:min-h-0 lg:max-w-none lg:flex-1 lg:items-center lg:justify-center">
              <video
                controls
                playsInline
                src={videoUrl}
                className="aspect-[9/16] w-full rounded-xl bg-black object-cover lg:h-full lg:w-auto lg:max-w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right column: telop + caption editing, scrolls independently */}
      <div className="mt-5 space-y-5 lg:mt-0">
        {locked && (
          <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-relaxed text-amber-800 ring-1 ring-amber-200 sm:p-5">
            動画の修正は1回までとなっております。内容をご確認のうえ、メールから承認または却下をお願いします。キャプションの修正のみ引き続き可能です。その他のご要望はご担当までご連絡ください。
          </div>
        )}
        <div
          className={`grid grid-cols-1 gap-3 ${
            locked ? "pointer-events-none opacity-50" : ""
          }`}
          aria-disabled={locked}
        >
          {telops.map((t) => {
            const val = values[t.role] ?? "";
            const textChanged = sanitizeTelop(val) !== t.text.trim();
            const isOpen = yomiOpen[t.role] ?? false;
            const yomiVal = yomiValues[t.role] ?? t.yomi;
            const yomiTrimmed = sanitizeYomi(yomiVal);
            const yomiErr = yomiError(yomiTrimmed);
            const yomiChangedFromPrefill =
              isOpen && yomiTrimmed !== sanitizeYomi(t.yomi);
            const yomiValid = yomiChangedFromPrefill && !yomiErr;
            const canSwap = t.scene_index !== null && !t.swapped;
            const swapQueued = canSwap && (swapOn[t.role] ?? false);
            const isChanged = textChanged || yomiValid || swapQueued;
            return (
              <div
                key={t.role}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-colors sm:p-5 ${
                  isChanged ? "ring-[var(--brand-orange)]" : "ring-black/5"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--brand-gray-light)]">
                    {t.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {textChanged && (
                      <span className="rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
                        変更あり
                      </span>
                    )}
                    {yomiValid && (
                      <span className="max-w-[10rem] truncate rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
                        読み変更あり
                      </span>
                    )}
                    {swapQueued && (
                      <span className="rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand-orange-dark)]">
                        映像差し替え
                      </span>
                    )}
                  </div>
                </div>
                <textarea
                  ref={autoGrow}
                  value={val}
                  disabled={locked}
                  onChange={(e) => {
                    updateValue(t.role, e.target.value);
                    autoGrow(e.target);
                  }}
                  maxLength={MAX_TEXT_LEN}
                  className="min-h-[3.25rem] w-full resize-none overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-3 py-2.5 text-sm text-[var(--brand-ink)] focus:border-[var(--brand-orange)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/30 disabled:cursor-not-allowed"
                />
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--brand-gray-light)]">
                    動画に表示される文章・推奨25字以内
                  </span>
                  <span className={telopCounterClass(val.length)}>
                    {val.length} / {MAX_TEXT_LEN}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={locked}
                  onClick={() => toggleYomi(t.role)}
                  className="mt-2 text-[11px] font-bold text-[var(--brand-orange-dark)] underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline"
                >
                  {isOpen ? "読み上げ台本を閉じる" : "読み間違いを直す(任意)"}
                </button>
                {isOpen && (
                  <div className="mt-2">
                    <div className="mb-1 text-[11px] font-bold text-[var(--brand-ink)]">
                      読み上げ台本
                      <span className="font-normal text-[var(--brand-gray-light)]">
                        (間違っている読みの部分だけ、ひらがなに書き換えてください)
                      </span>
                    </div>
                    <textarea
                      ref={autoGrow}
                      value={yomiVal}
                      disabled={locked}
                      onChange={(e) => {
                        updateYomi(t.role, e.target.value);
                        autoGrow(e.target);
                      }}
                      maxLength={MAX_YOMI_LEN}
                      className="min-h-[3.25rem] w-full resize-none overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-3 py-2.5 text-sm text-[var(--brand-ink)] focus:border-[var(--brand-orange)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/30 disabled:cursor-not-allowed"
                    />
                    <p className="mt-1 text-[10px] text-[var(--brand-gray-light)]">
                      例:「格子窓」→「こうしまど」のように、直したい部分をひらがなで
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span
                        className={
                          yomiErr
                            ? "text-red-500"
                            : "text-[var(--brand-gray-light)]"
                        }
                      >
                        {yomiErr ?? " "}
                      </span>
                      <span className="text-[var(--brand-gray-light)]">
                        {yomiVal.length} / {MAX_YOMI_LEN}
                      </span>
                    </div>
                  </div>
                )}

                {t.scene_index !== null &&
                  (t.swapped ? (
                    <div className="mt-3 flex items-start gap-2 border-t border-[var(--brand-border)] pt-3 text-[11px] text-[var(--brand-gray-light)]">
                      <span className="shrink-0 rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 font-bold text-[var(--brand-orange-dark)]">
                        差し替え済み
                      </span>
                      <span>元に戻したい場合はご担当までご連絡ください</span>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-3 border-t border-[var(--brand-border)] pt-3">
                      {t.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.thumbnail}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-[var(--brand-ink)]">
                          ⚠️ この場面の映像に乱れがある場合
                        </p>
                        <label className="mt-1.5 flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={swapOn[t.role] ?? false}
                            disabled={locked}
                            onChange={() => toggleSwap(t.role)}
                            className="h-4 w-4 shrink-0 rounded border-[var(--brand-border)] text-[var(--brand-orange)] focus:ring-[var(--brand-orange)]/30 disabled:cursor-not-allowed"
                          />
                          <span className="text-[11px] text-[var(--brand-gray)]">
                            写真のままゆっくり動く表示に差し替える
                          </span>
                        </label>
                      </div>
                    </div>
                  ))}
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
              ref={autoGrow}
              value={captionValue}
              onChange={(e) => {
                updateCaption(e.target.value);
                autoGrow(e.target);
              }}
              maxLength={MAX_CAPTION_LEN}
              className="min-h-[10rem] w-full resize-none overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-cream)]/40 px-3 py-2.5 text-sm text-[var(--brand-ink)] focus:border-[var(--brand-orange)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]/30"
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
            ※改行するとその位置で字幕が折り返されます(改行入りのテロップは固定表示になります)
          </p>
          <p className="mt-1.5">
            ※動画内の読み上げは基本的に自動で調整されます。読み間違いがある時だけ「読み間違いを直す」を開いてください
          </p>
          <p className="mt-1.5">
            ※家賃・間取りなどの数値は資料(マイソク)にもとづいています。数値そのものに誤りがある場合は、テロップ修正ではなく資料の再送をお願いします
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
        {changed.length === 0 && !captionChanged && swaps.length === 0 && (
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
            {swaps.length > 0 && (
              <p className="mt-3 text-sm font-bold text-red-600">
                この操作は元に戻せません。差し替え後にもう一度動画素材へ戻すことはできませんので、内容をご確認のうえお進みください。
              </p>
            )}
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
