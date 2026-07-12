"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ASPECT_RATIOS,
  DEAL_TYPES,
  MAX_PHOTOS,
  RECOMMENDED_PHOTOS,
  checkMaisokuFile,
  checkPhotoFile,
  type AspectRatio,
  type DealType,
} from "@/app/_lib/portalSubmitShared";

// /portal/submit の本体フォーム。項目構成は現行のGoogle標準フォーム
// (fudosan-video/docs/forms_v15/standard_form.gs が拾う質問)と同じ:
//   マイソク / そのまま使用する写真 / アスペクト比 / 取引種別
// +通知メール(GASでは回答者メール自動取得だった分を明示入力に)。
// 秘密鍵の質問だけはポータルでは不要 — ログイン済みなのでサーバー側が
// 契約社シートから取得する(鍵はブラウザに一切来ない)。
//
// 送信フロー: init(execフォルダ作成)→ ファイルごとに upload-url →
// ブラウザから Drive session URL へ直接 PUT(進捗表示付き)→ submit。
// 二重送信ガード: phase !== "idle" の間はボタン無効。実送信成功後は
// /portal?submitted=1 へリダイレクト。ドライラン(送信フラグOFF)は
// 「送信機能は準備中です」+検証サマリを表示する。

type UploadState = "wait" | "uploading" | "done" | "error";

interface UploadItem {
  label: string;
  pct: number;
  state: UploadState;
}

type Phase = "idle" | "working" | "done_dry";

interface DryRunResult {
  message: string;
  execId: string;
  photoCount: number;
  payloadJson: string;
}

const ASPECT_LABELS: Record<AspectRatio, string> = {
  "9:16": "9:16 縦型(リール/TikTok・推奨)",
  "1:1": "1:1 正方形",
};

const DEAL_LABELS: Record<DealType, string> = {
  rental: "賃貸",
  sale: "売買",
};

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

/** Drive resumable session URL へファイルを PUT(XHRで進捗取得)。
 * 成功時は Drive fileId を返す。 */
function putFileToDrive(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as { id?: string };
          if (json.id) {
            resolve(json.id);
          } else {
            reject(new Error("アップロード応答にファイルIDがありません"));
          }
        } catch {
          reject(new Error("アップロード応答の解析に失敗しました"));
        }
      } else {
        reject(new Error(`アップロードに失敗しました (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("アップロード中に通信エラーが発生しました"));
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.send(file);
  });
}

async function postJson(
  path: string,
  body: unknown
): Promise<{ res: Response; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

export default function SubmitForm({
  defaultEmail,
}: {
  defaultEmail: string;
}) {
  const router = useRouter();
  const [maisoku, setMaisoku] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [deal, setDeal] = useState<DealType>("rental");
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [stepNote, setStepNote] = useState("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const maisokuInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "working";

  function handleMaisokuPick(files: FileList | null) {
    setError("");
    const file = files?.[0];
    if (!file) return;
    const check = checkMaisokuFile(file.name, file.type, file.size);
    if (!check.ok) {
      setError(check.error || "このファイルは使用できません");
      return;
    }
    setMaisoku(file);
  }

  function handlePhotosPick(files: FileList | null) {
    setError("");
    if (!files || files.length === 0) return;
    const next = [...photos];
    for (const file of Array.from(files)) {
      const check = checkPhotoFile(file.name, file.type, file.size);
      if (!check.ok) {
        setError(check.error || "このファイルは使用できません");
        return;
      }
      // 同名+同サイズは重複追加しない
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    if (next.length > MAX_PHOTOS) {
      setError(`写真は最大${MAX_PHOTOS}枚までです(現在${next.length}枚選択されています)`);
      return;
    }
    setPhotos(next);
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  const canSubmit =
    !!maisoku && photos.length >= 1 && email.trim().length > 3 && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !maisoku) return;
    setError("");
    setDryRun(null);
    setPhase("working");

    const items: UploadItem[] = [
      { label: `マイソク: ${maisoku.name}`, pct: 0, state: "wait" },
      ...photos.map((f) => ({
        label: `写真: ${f.name}`,
        pct: 0,
        state: "wait" as UploadState,
      })),
    ];
    setUploads(items);

    const setItem = (i: number, patch: Partial<UploadItem>) =>
      setUploads((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
      );

    try {
      // 1) exec フォルダ作成
      setStepNote("アップロード先を準備しています…");
      const init = await postJson("/api/portal/submit/init", {});
      if (!init.res.ok || !init.data.ok) {
        throw new Error(
          (init.data.error as string) || "アップロード準備に失敗しました"
        );
      }
      const token = init.data.token as string;

      // 2) ファイルアップロード(マイソク→写真の順に直列・進捗表示)
      setStepNote("ファイルをアップロードしています…");
      const uploadOne = async (
        file: File,
        target: "maisoku" | "photo",
        index: number,
        itemIdx: number
      ): Promise<string> => {
        setItem(itemIdx, { state: "uploading" });
        const urlRes = await postJson("/api/portal/submit/upload-url", {
          token,
          target,
          name: file.name,
          mime_type: file.type,
          size: file.size,
          index,
        });
        if (!urlRes.res.ok || !urlRes.data.ok) {
          setItem(itemIdx, { state: "error" });
          throw new Error(
            (urlRes.data.error as string) || "アップロード準備に失敗しました"
          );
        }
        try {
          const fileId = await putFileToDrive(
            urlRes.data.upload_url as string,
            file,
            (pct) => setItem(itemIdx, { pct })
          );
          setItem(itemIdx, { pct: 100, state: "done" });
          return fileId;
        } catch (err) {
          setItem(itemIdx, { state: "error" });
          throw err;
        }
      };

      const maisokuFileId = await uploadOne(maisoku, "maisoku", 0, 0);
      const photoFileIds: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        photoFileIds.push(await uploadOne(photos[i], "photo", i, i + 1));
      }

      // 3) 送信(サーバーがペイロード組み立て+送信ゲート判定)
      setStepNote("リクエストを送信しています…");
      const submit = await postJson("/api/portal/submit", {
        token,
        maisoku_file_id: maisokuFileId,
        photo_file_ids: photoFileIds,
        aspect_ratio: aspect,
        deal_type: deal,
        email: email.trim(),
      });
      if (!submit.res.ok || !submit.data.ok) {
        throw new Error(
          (submit.data.error as string) || "送信に失敗しました"
        );
      }

      if (submit.data.sent === true) {
        // 実送信成功 → ダッシュボードへ(二重送信防止のためこの画面を離れる)
        router.push("/portal?submitted=1");
        router.refresh();
        return;
      }

      // ドライラン(送信フラグOFF)
      setDryRun({
        message:
          (submit.data.message as string) || "送信機能は準備中です",
        execId: (submit.data.exec_id as string) || "",
        photoCount:
          typeof submit.data.photo_count === "number"
            ? submit.data.photo_count
            : photoFileIds.length,
        payloadJson: JSON.stringify(submit.data.payload ?? {}, null, 2),
      });
      setPhase("done_dry");
      setStepNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPhase("idle");
      setStepNote("");
    }
  }

  const inputClass =
    "w-full border border-black/10 bg-white/80 text-[var(--brand-ink)] placeholder:text-black/35 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white/95 transition-colors";
  const pickerButtonClass =
    "inline-block cursor-pointer rounded-xl border border-dashed border-black/20 bg-white/60 px-4 py-3 text-sm font-medium text-[var(--brand-ink)]/80 hover:bg-white/90 hover:border-[var(--brand-orange)]/60 transition-colors";

  if (phase === "done_dry" && dryRun) {
    return (
      <div className="liquid-glass-white rounded-2xl shadow-2xl shadow-black/10 p-6 sm:p-8">
        <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
        <h2 className="text-lg font-bold text-[var(--brand-ink)] text-center">
          送信機能は準備中です
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)] text-center">
          {dryRun.message}
        </p>
        <div className="mt-5 rounded-xl bg-white/70 border border-black/5 p-4 text-xs text-[var(--brand-gray)] space-y-1">
          <div>受付ID: {dryRun.execId || "-"}</div>
          <div>アップロード済み写真: {dryRun.photoCount}枚</div>
          <div>リクエスト内容の検証: 合格</div>
        </div>
        <details className="mt-3 text-xs text-[var(--brand-gray-light)]">
          <summary className="cursor-pointer select-none">
            技術情報(確認用ペイロード)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-3 text-[10px] leading-relaxed">
            {dryRun.payloadJson}
          </pre>
        </details>
        <a
          href="/portal"
          className="mt-6 block w-full text-center bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-3 text-sm hover:shadow-lg transition-all active:scale-[0.98]"
        >
          マイページへ戻る
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="liquid-glass-white rounded-2xl shadow-2xl shadow-black/10 p-6 sm:p-8 space-y-6"
    >
      {/* マイソク */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
          マイソク(物件図面) <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-[var(--brand-gray-light)] mb-2">
          PDF または JPEG/PNG を1枚。物件情報はここから自動で読み取ります
        </p>
        <input
          ref={maisokuInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            handleMaisokuPick(e.target.files);
            e.target.value = "";
          }}
        />
        {maisoku ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-black/5 px-4 py-3">
            <span className="flex-1 min-w-0 truncate text-sm text-[var(--brand-ink)]">
              {maisoku.name}
            </span>
            <span className="text-xs text-[var(--brand-gray-light)] shrink-0">
              {formatBytes(maisoku.size)}
            </span>
            {!busy && (
              <button
                type="button"
                onClick={() => setMaisoku(null)}
                className="text-xs text-red-500 hover:text-red-600 shrink-0"
              >
                削除
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={pickerButtonClass}
            disabled={busy}
            onClick={() => maisokuInputRef.current?.click()}
          >
            + ファイルを選択
          </button>
        )}
      </div>

      {/* 物件写真 */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
          物件写真 <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-[var(--brand-gray-light)] mb-2">
          そのまま動画に使用する写真({RECOMMENDED_PHOTOS}推奨・最大
          {MAX_PHOTOS}枚)。JPEG / PNG / WebP
        </p>
        <input
          ref={photosInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            handlePhotosPick(e.target.files);
            e.target.value = "";
          }}
        />
        {photos.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {photos.map((f, i) => (
              <li
                key={`${f.name}-${f.size}`}
                className="flex items-center gap-3 rounded-xl bg-white/70 border border-black/5 px-4 py-2.5"
              >
                <span className="text-[11px] font-semibold text-[var(--brand-gray-light)] shrink-0 w-5">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm text-[var(--brand-ink)]">
                  {f.name}
                </span>
                <span className="text-xs text-[var(--brand-gray-light)] shrink-0">
                  {formatBytes(f.size)}
                </span>
                {!busy && (
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="text-xs text-red-500 hover:text-red-600 shrink-0"
                  >
                    削除
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            className={pickerButtonClass}
            disabled={busy}
            onClick={() => photosInputRef.current?.click()}
          >
            + 写真を追加({photos.length}/{MAX_PHOTOS})
          </button>
        )}
      </div>

      {/* アスペクト比 */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-2">
          動画のアスペクト比
        </label>
        <div className="space-y-2">
          {ASPECT_RATIOS.map((a) => (
            <label
              key={a}
              className="flex items-center gap-3 rounded-xl bg-white/60 border border-black/5 px-4 py-3 cursor-pointer hover:bg-white/85 transition-colors"
            >
              <input
                type="radio"
                name="aspect"
                checked={aspect === a}
                disabled={busy}
                onChange={() => setAspect(a)}
                className="accent-[var(--brand-orange)]"
              />
              <span className="text-sm text-[var(--brand-ink)]">
                {ASPECT_LABELS[a]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 取引種別 */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-2">
          取引種別
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DEAL_TYPES.map((d) => (
            <label
              key={d}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/60 border border-black/5 px-4 py-3 cursor-pointer hover:bg-white/85 transition-colors"
            >
              <input
                type="radio"
                name="deal"
                checked={deal === d}
                disabled={busy}
                onChange={() => setDeal(d)}
                className="accent-[var(--brand-orange)]"
              />
              <span className="text-sm text-[var(--brand-ink)]">
                {DEAL_LABELS[d]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 通知メール */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
          通知メールアドレス <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-[var(--brand-gray-light)] mb-2">
          完成動画の確認依頼・結果のご連絡をお送りします
        </p>
        <input
          type="email"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mail@example.com"
          className={inputClass}
        />
      </div>

      {/* 進捗 */}
      {busy && (
        <div className="rounded-xl bg-white/70 border border-black/5 p-4 space-y-2">
          <div className="text-xs font-semibold text-[var(--brand-ink)]/70">
            {stepNote}
          </div>
          {uploads.map((u, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between gap-2 text-[var(--brand-gray)]">
                <span className="truncate">{u.label}</span>
                <span className="shrink-0">
                  {u.state === "done"
                    ? "完了"
                    : u.state === "error"
                      ? "失敗"
                      : u.state === "uploading"
                        ? `${u.pct}%`
                        : "待機中"}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    u.state === "error"
                      ? "bg-red-400"
                      : "bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)]"
                  }`}
                  style={{ width: `${u.state === "done" ? 100 : u.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-3.5 text-base hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {busy ? "送信中…(画面を閉じないでください)" : "この内容で動画作成を依頼する"}
      </button>
      <p className="text-center text-xs text-[var(--brand-ink)]/50">
        送信後、完成動画の確認依頼がメールで届きます(通常15〜30分)
      </p>
    </form>
  );
}
