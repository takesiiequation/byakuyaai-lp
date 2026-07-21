"use client";

// 部屋カードUI(Phase A・2026-07-21・fudosan-video/docs/smapho_hitotsu_
// design.md §2)。SubmitForm.tsx から env `PORTAL_ROOMS_UI` が "true" の
// ときだけ描画される(状態/アップロード/送信ロジックは呼び出し元が持つ
// — このコンポーネントは純粋な表示+コールバック中継)。
//
// カード内投入口は「写真(1〜2枚)」or「動画(1本)」の排他。写真2枚の
// ときだけ「始まりの1枚/終わりの1枚」ラベル+入替ボタンを出す(2枚の
// 意味論=順序のみ・design.md §0-4)。生成AI用語は出さない — 文言は
// 「この順に映像が動きます」等の顧客語彙のみ(要件7)。

import {
  MAX_ROOMS,
  MAX_ROOM_PHOTOS_PER_CARD,
  MAX_VIDEO_DURATION_SEC,
  ROOM_LABEL_CHIPS,
  ROOM_LABEL_OTHER,
  ROOM_PHOTO_MIN_LONG_SIDE,
} from "@/app/_lib/portalSubmitShared";

export interface RoomLocalPhotoItem {
  kind: "photo";
  file: File;
  lowRes: boolean | null; // null = 判定中
}

export interface RoomLocalVideoItem {
  kind: "video";
  file: File;
  durationSec: number | null; // null = 取得中
}

export type RoomLocalItem = RoomLocalPhotoItem | RoomLocalVideoItem;

export interface RoomCardState {
  uid: string;
  label: string | null;
  customLabelMode: boolean;
  items: RoomLocalItem[];
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

const pickerButtonClass =
  "inline-block cursor-pointer rounded-xl border border-dashed border-black/20 bg-white/60 px-4 py-3 text-sm font-medium text-[var(--brand-ink)]/80 hover:bg-white/90 hover:border-[var(--brand-orange)]/60 transition-colors";
const chipClass =
  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer";
const chipActiveClass =
  "border-[var(--brand-orange)] bg-[var(--brand-orange)]/15 text-[var(--brand-orange-dark)]";
const chipInactiveClass =
  "border-black/10 bg-white/60 text-[var(--brand-ink)]/70 hover:bg-white/90";

export interface RoomCardsFieldProps {
  rooms: RoomCardState[];
  busy: boolean;
  onAddRoom: () => void;
  onRemoveRoom: (uid: string) => void;
  onMoveRoom: (uid: string, dir: -1 | 1) => void;
  onSetLabelChip: (uid: string, chip: string) => void;
  onSetLabelCustomText: (uid: string, text: string) => void;
  onAddPhotos: (uid: string, files: FileList) => void;
  onAddVideo: (uid: string, file: File) => void;
  onRemoveItem: (uid: string, itemIdx: number) => void;
  onSwapFrames: (uid: string) => void;
}

export default function RoomCardsField({
  rooms,
  busy,
  onAddRoom,
  onRemoveRoom,
  onMoveRoom,
  onSetLabelChip,
  onSetLabelCustomText,
  onAddPhotos,
  onAddVideo,
  onRemoveItem,
  onSwapFrames,
}: RoomCardsFieldProps) {
  return (
    <div className="space-y-4">
      {rooms.length === 0 && (
        <p className="text-xs text-[var(--brand-gray-light)]">
          「部屋を追加」から、部屋ごとに写真(1〜2枚)または動画(1本)を追加してください。
        </p>
      )}

      {rooms.map((room, idx) => {
        const hasVideo = room.items.some((it) => it.kind === "video");
        const photoCount = room.items.filter((it) => it.kind === "photo").length;
        const canAddPhoto = !hasVideo && photoCount < MAX_ROOM_PHOTOS_PER_CARD;

        return (
          <div
            key={room.uid}
            className="rounded-xl border border-black/10 bg-white/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[var(--brand-ink)]">
                部屋 {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy || idx === 0}
                  onClick={() => onMoveRoom(room.uid, -1)}
                  className="rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs text-[var(--brand-ink)]/70 disabled:opacity-30 hover:bg-white transition-colors"
                  aria-label="上へ移動"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || idx === rooms.length - 1}
                  onClick={() => onMoveRoom(room.uid, 1)}
                  className="rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-xs text-[var(--brand-ink)]/70 disabled:opacity-30 hover:bg-white transition-colors"
                  aria-label="下へ移動"
                >
                  ↓
                </button>
                {!busy && (
                  <button
                    type="button"
                    onClick={() => onRemoveRoom(room.uid)}
                    className="ml-1 text-xs text-red-500 hover:text-red-600"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>

            {/* 部屋名(任意・チップ+自由記入) */}
            <div>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_LABEL_CHIPS.map((chip) => {
                  const active =
                    chip === ROOM_LABEL_OTHER
                      ? room.customLabelMode
                      : room.label === chip && !room.customLabelMode;
                  return (
                    <button
                      key={chip}
                      type="button"
                      disabled={busy}
                      onClick={() => onSetLabelChip(room.uid, chip)}
                      className={`${chipClass} ${active ? chipActiveClass : chipInactiveClass}`}
                    >
                      {chip}
                    </button>
                  );
                })}
              </div>
              {room.customLabelMode && (
                <input
                  type="text"
                  value={room.label ?? ""}
                  disabled={busy}
                  onChange={(e) => onSetLabelCustomText(room.uid, e.target.value)}
                  placeholder="部屋名を入力(任意)"
                  maxLength={50}
                  className="mt-2 w-full rounded-lg border border-black/10 bg-white/80 px-3 py-2 text-sm text-[var(--brand-ink)] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                />
              )}
            </div>

            {/* 投入口: 写真1〜2枚 or 動画1本(排他) */}
            {room.items.length === 0 && (
              <div className="flex flex-wrap gap-2">
                <label className={pickerButtonClass}>
                  + 写真を追加(1〜2枚)
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    disabled={busy}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        onAddPhotos(room.uid, e.target.files);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className={pickerButtonClass}>
                  + 動画を追加(1本)
                  <input
                    type="file"
                    accept=".mp4,.mov,video/mp4,video/quicktime"
                    disabled={busy}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onAddVideo(room.uid, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            {room.items.length > 0 && (
              <ul className="space-y-1.5">
                {room.items.map((it, ii) => {
                  const frameLabel =
                    it.kind === "photo" && room.items.length === 2
                      ? ii === 0
                        ? "始まりの1枚"
                        : "終わりの1枚"
                      : null;
                  return (
                    <li
                      key={`${it.file.name}-${it.file.size}-${ii}`}
                      className="rounded-xl bg-white/70 border border-black/5 px-4 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        {frameLabel && (
                          <span className="shrink-0 rounded-full bg-[var(--brand-orange)]/15 text-[var(--brand-orange-dark)] text-[10px] font-semibold px-2 py-0.5">
                            {frameLabel}
                          </span>
                        )}
                        <span className="flex-1 min-w-0 truncate text-sm text-[var(--brand-ink)]">
                          {it.file.name}
                        </span>
                        <span className="text-xs text-[var(--brand-gray-light)] shrink-0">
                          {formatBytes(it.file.size)}
                        </span>
                        {!busy && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(room.uid, ii)}
                            className="text-xs text-red-500 hover:text-red-600 shrink-0"
                          >
                            削除
                          </button>
                        )}
                      </div>
                      {it.kind === "photo" && it.lowRes === true && (
                        <p className="mt-1 text-[11px] text-amber-600">
                          画質が少し粗いようです(長辺{ROOM_PHOTO_MIN_LONG_SIDE}px未満)。このまま送信することもできます
                        </p>
                      )}
                      {it.kind === "video" && it.durationSec !== null && (
                        <p className="mt-1 text-[11px] text-[var(--brand-gray-light)]">
                          長さ: 約{Math.round(it.durationSec)}秒・1080p設定推奨
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {room.items.length === 2 && room.items.every((it) => it.kind === "photo") && (
              <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--brand-gray-light)]">
                <span>始まりの1枚→終わりの1枚の順に映像が動きます</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSwapFrames(room.uid)}
                  className="shrink-0 rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-[var(--brand-ink)]/70 hover:bg-white transition-colors"
                >
                  ↕ 入れ替える
                </button>
              </div>
            )}

            {room.items.length === 1 && canAddPhoto && (
              <label className={pickerButtonClass}>
                + もう1枚追加(終わりの1枚)
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={busy}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onAddPhotos(room.uid, e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            {room.items.length === 1 && hasVideo && (
              <p className="text-[11px] text-[var(--brand-gray-light)]">
                動画は{MAX_VIDEO_DURATION_SEC}秒以内・1080p設定推奨です
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        disabled={busy || rooms.length >= MAX_ROOMS}
        onClick={onAddRoom}
        className={`${pickerButtonClass} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        + 部屋を追加({rooms.length}/{MAX_ROOMS})
      </button>
    </div>
  );
}
