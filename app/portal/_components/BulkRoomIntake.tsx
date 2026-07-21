"use client";

// 一括投入の入口(2026-07-21・design.md「入口UIの再設計」)。
// SubmitForm から PORTAL_ROOMS_UI かつ「bulk」モードのときだけ描画される
// 表示専用コンポーネント(状態/ペアリング処理は呼び出し元が持つ)。
// 「超分かりやすく簡単に素早く」— 写真・動画をまとめて選ぶだけで、
// 部屋ごとの振り分けは自動で行われる(結果は次の確認画面で必ず直せる)。

const pickerButtonClass =
  "inline-flex w-full items-center justify-center cursor-pointer rounded-xl border-2 border-dashed border-[var(--brand-orange)]/40 bg-white/60 px-4 py-8 text-sm font-semibold text-[var(--brand-ink)] hover:bg-white/90 hover:border-[var(--brand-orange)]/70 transition-colors";

export interface BulkRoomIntakeProps {
  busy: boolean;
  analyzing: boolean;
  onFilesSelected: (files: FileList) => void;
  onSwitchToAdvanced: () => void;
}

export default function BulkRoomIntake({
  busy,
  analyzing,
  onFilesSelected,
  onSwitchToAdvanced,
}: BulkRoomIntakeProps) {
  const disabled = busy || analyzing;
  return (
    <div className="space-y-2">
      <label className={`${pickerButtonClass} ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
        <span>
          {analyzing
            ? "自動で部屋ごとに振り分けています…"
            : "📷 写真をまとめて選択(動画も可)"}
        </span>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-[var(--brand-gray-light)]">
        選ぶだけで、部屋ごとに自動で振り分けます。振り分け結果は次の画面で自由に直せます
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
