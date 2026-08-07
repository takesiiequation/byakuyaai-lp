"use client";

// 一括投入の入口(入稿UI仕様v3・2026-07-21岡本裁定で改訂)。
// SubmitForm から PORTAL_ROOMS_UI かつ「bulk」モードのときだけ描画される
// 表示専用コンポーネント(状態/ペアリング処理は呼び出し元が持つ)。
//
// 岡本裁定: 写真と動画は体験が違うので同一ピッカーで混在受付しない
// (「写真なら2枚1組」「動画なら動画からカット」)。タブで入口を分け、
// accept属性もタブごとに image/* と video/* に分離する。両タブから
// 追加した部屋は呼び出し元の同一 rooms state に合流する(このコンポー
// ネント自体はどちらのタブが選ばれているかのローカルUI状態のみ持つ)。
//
// 動画タブの説明文+ガイドリンク(2026-07-30追加): 札幌カンリセンター様が
// 「ドアを開ける→入室→部屋を見せる」の長回し構成で自主撮影・入稿し、当時の
// 先頭切り出し仕様のせいで部屋が映る前に切れる事故が発生。n8n側は改修済み
// (30秒まで受け入れ・頭35%を飛ばして使う)だが、入稿の入口でも「短く区切る」
// を案内する。リンクのスタイルは SubmitForm.tsx の写真/動画共通ガイドリンク
// (/portal/guide への text-xs font-semibold text-[var(--brand-orange-dark)]
// underline)を踏襲。

// ドラッグ&ドロップ(2026-08-07 岡本要望): PCでフォルダから直接放り込めるように。
// タブごとのaccept方針は維持し、投下ファイルは拡張子/MIMEで写真・動画に振り分けて
// そのタブの受け口へ渡す(タブと違う種類が混ざっていたらその分だけ無視+一言案内)。
// モバイルは従来どおりタップ選択(ドロップイベント自体が発火しない)。

import { useRef, useState } from "react";
import { MAX_VIDEO_DURATION_SEC } from "@/app/_lib/portalSubmitShared";

const pickerButtonClass =
  "inline-flex w-full items-center justify-center cursor-pointer rounded-xl border-2 border-dashed border-[var(--brand-orange)]/40 bg-white/60 px-4 py-8 text-sm font-semibold text-[var(--brand-ink)] hover:bg-white/90 hover:border-[var(--brand-orange)]/70 transition-colors";

type IntakeTab = "photo" | "video";

function tabButtonClass(active: boolean): string {
  return `flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
    active
      ? "bg-[var(--brand-orange)] text-white shadow-sm"
      : "bg-transparent text-[var(--brand-ink)]/55 hover:bg-white/70"
  }`;
}

export interface BulkRoomIntakeProps {
  busy: boolean;
  analyzing: boolean;
  /** すでに確認リストへ部屋が合流済みか。追加投入時はボタン文言を
   * 「+追加」寄りに変える(初回選択と同じ導線だが意味合いが違うため)。 */
  hasRooms: boolean;
  onPhotoFilesSelected: (files: FileList) => void;
  onVideoFilesSelected: (files: FileList) => void;
  onSwitchToAdvanced: () => void;
}

const PHOTO_RE = /\.(jpe?g|png|webp)$/i;
const VIDEO_RE = /\.(mp4|mov)$/i;

function isPhoto(f: File): boolean {
  return f.type.startsWith("image/") || PHOTO_RE.test(f.name);
}
function isVideo(f: File): boolean {
  return f.type.startsWith("video/") || VIDEO_RE.test(f.name);
}

/** File[] を FileList 相当へ。既存の onXxxFilesSelected(FileList) の
 * シグネチャを変えずにD&Dを足すためのアダプタ。 */
function toFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

export default function BulkRoomIntake({
  busy,
  analyzing,
  hasRooms,
  onPhotoFilesSelected,
  onVideoFilesSelected,
  onSwitchToAdvanced,
}: BulkRoomIntakeProps) {
  const [tab, setTab] = useState<IntakeTab>("photo");
  const [dragOver, setDragOver] = useState(false);
  const [dropNote, setDropNote] = useState("");
  const depth = useRef(0); // 子要素をまたぐdragleaveでハイライトが消えるのを防ぐ
  const disabled = busy || analyzing;

  function onDragEnter(e: React.DragEvent) {
    if (disabled) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    depth.current += 1;
    setDragOver(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (disabled) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault(); // これが無いとブラウザがファイルを開いてしまう
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave() {
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    if (disabled) return;
    e.preventDefault();
    depth.current = 0;
    setDragOver(false);
    setDropNote("");
    const all = Array.from(e.dataTransfer.files || []);
    if (all.length === 0) return;
    const wanted = tab === "photo" ? all.filter(isPhoto) : all.filter(isVideo);
    const skipped = all.length - wanted.length;
    if (wanted.length === 0) {
      setDropNote(
        tab === "photo"
          ? "写真タブでは写真ファイル(JPEG/PNG/WebP)のみお預かりできます。動画は「動画で作る」タブへ。"
          : "動画タブでは動画ファイル(MP4/MOV)のみお預かりできます。写真は「写真で作る」タブへ。"
      );
      return;
    }
    if (skipped > 0) {
      setDropNote(
        `${wanted.length}件を受け付けました(このタブで扱えない${skipped}件は取り込んでいません)。`
      );
    }
    if (tab === "photo") onPhotoFilesSelected(toFileList(wanted));
    else onVideoFilesSelected(toFileList(wanted));
  }

  return (
    <div
      className="space-y-2"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex gap-1 rounded-xl border border-black/10 bg-white/40 p-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTab("photo")}
          className={tabButtonClass(tab === "photo")}
        >
          📷 写真で作る(2枚1組)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setTab("video")}
          className={tabButtonClass(tab === "video")}
        >
          🎥 動画で作る
        </button>
      </div>

      {tab === "photo" ? (
        <>
          <label
            className={`${pickerButtonClass} ${dragOver ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10" : ""} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
          >
            <span>
              {dragOver
                ? "ここに写真をドロップ"
                : analyzing
                ? "撮影順に部屋へ振り分けています…"
                  : hasRooms
                    ? "+ 写真を追加で選択"
                    : "📷 写真をまとめて選択"}
            </span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              multiple
              disabled={disabled}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onPhotoFilesSelected(e.target.files);
                }
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-[var(--brand-gray-light)]">
            同じ部屋を2枚1組(始まり→終わり)で撮ってアップロードしてください。撮影した順に自動で2枚ずつ部屋にまとまります(結果は次の一覧で自由に直せます)。2枚1組が基本です。どうしても難しい場合のみ1枚でも作成できます
          </p>
        </>
      ) : (
        <>
          <label
            className={`${pickerButtonClass} ${dragOver ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10" : ""} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
          >
            <span>
              {dragOver
                ? "ここに動画をドロップ"
                : hasRooms
                  ? "+ 動画を追加で選択"
                  : "🎥 動画をまとめて選択"}
            </span>
            <input
              type="file"
              accept=".mp4,.mov,video/mp4,video/quicktime"
              multiple
              disabled={disabled}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onVideoFilesSelected(e.target.files);
                }
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-[var(--brand-gray-light)]">
            1本の動画が1つの部屋になります(1080p設定推奨)。<strong>1本5〜10秒がおすすめ</strong>です(最大{MAX_VIDEO_DURATION_SEC}秒まで)。長い動画は、お部屋が見えている部分を自動で選んで使用します
          </p>
          <a
            href="/portal/guide/video"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs font-semibold text-[var(--brand-orange-dark)] underline decoration-[var(--brand-orange)]/40 underline-offset-2 hover:decoration-current"
          >
            🎥 動画で撮るときのコツはこちら
          </a>
        </>
      )}

      {dropNote && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          {dropNote}
        </p>
      )}
      <p className="hidden text-[11px] text-[var(--brand-gray-light)] sm:block">
        ※ パソコンからは、フォルダのファイルをこの枠にドラッグ&ドロップでも追加できます
      </p>

      <button
        type="button"
        disabled={disabled}
        onClick={onSwitchToAdvanced}
        className="text-xs underline text-[var(--brand-ink)]/50 hover:text-[var(--brand-ink)]/80 disabled:opacity-50"
      >
        🔧 詳しく自分で整理する(部屋をひとつずつ自分で作る)
      </button>
    </div>
  );
}
