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
//
// v3.1改修(2026-07-21夜・岡本FB6点・design.md「UI v3.1改修+誤ペア三重
// ガード」段1):
//   ①部屋名チップは横スクロール1行化(縦4行占有していた主犯)
//   ②ペア写真は横並び+バッジをサムネへオーバーレイ(旧: 縦積み2枚)
//   ③画質警告はアイコン+短文1行に圧縮
//   ④操作列(移動/削除/ペア解除/入替)を小型ボタン1行へ集約
//   ⑤カード全体の余白を締める
// 狙いはスマホ430px幅で5部屋が約1.5画面に収まる密度。
// +誤ペア第2ガード: 写真2枚が揃うたび(自動仕分け直後/手動組み替え後/
// 2枚目追加後のいずれも)dHash(roomAutoPairing.tsの資産)で類似度を
// 非同期チェックし、閾値超なら非ブロッキング警告を出す(PairMismatchWarning)。

import { useEffect, useRef, useState } from "react";
import {
  MAX_ROOMS,
  MAX_ROOM_PHOTOS_PER_CARD,
  MAX_VIDEO_DURATION_SEC,
  ROOM_LABEL_CHIPS,
  ROOM_LABEL_OTHER,
} from "@/app/_lib/portalSubmitShared";
import {
  PAIR_MISMATCH_THRESHOLD,
  computePairMismatchDistance,
} from "@/app/portal/_lib/roomAutoPairing";

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

// v3.1: サムネは2種類のサイズ。単騎/動画の縦積みリストは64px、ペア横並び
// は視認性を保ちつつ80px(旧: 96pxの2枚縦積みから大幅圧縮)。
const thumbClassSingle =
  "h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-black/10 bg-black/5";
const thumbClassPair =
  "h-20 w-20 shrink-0 rounded-lg object-cover ring-1 ring-black/10 bg-black/5";

/** 部屋カードUI サムネイル(P1・入稿UI仕様v3)。写真は実画像、動画は
 * <video>のメタデータプレビュー(muted・自動再生しない=poster的表示)。
 * objectURLの生成と破棄(revoke)は同一のuseEffect呼び出しに閉じ込める —
 * useMemoで作るとStrictModeの mount→cleanup→mount でrevoke済みURLが
 * memoに残り、破棄済みblobを参照し続ける(ERR_FILE_NOT_FOUND)。effect
 * 1回の実行が自分のURLだけを所有すれば、二重マウントでもfile差し替え
 * でもアンマウントでも必ず対で生成/破棄される=メモリリーク防止。 */
function ItemThumbnail({
  file,
  kind,
  className = thumbClassSingle,
}: {
  file: File;
  kind: "photo" | "video";
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- objectURLの所有権をこのeffect実行に閉じるための同期set(上記コメント)
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (!url) return <div className={className} aria-hidden />;

  if (kind === "photo") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={className} />
    );
  }
  return (
    <video
      src={url}
      muted
      playsInline
      preload="metadata"
      className={className}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        try {
          // 先頭フレームを描画させるための最小シーク(黒画面のまま止まる
          // ブラウザ対策)。失敗しても致命ではない(fail-soft)。
          v.currentTime = Math.min(0.1, v.duration || 0.1);
        } catch {
          // no-op
        }
      }}
    />
  );
}

/** ペア妥当性警告(v3.1改修B)。2枚1組の写真がdHashハミング距離的に
 * 別部屋の可能性が高いときだけ非ブロッキングの注意文を出す。ファイル
 * (fileA/fileB)の参照が変わるたび=ペアの組み替え・2枚目追加のたびに
 * 再計算する。ペア解除/単騎化されるとこのコンポーネント自体がアン
 * マウントされ、警告は自然に消える。計算中は何も表示しない・計算失敗は
 * サイレントに警告なし扱い(fail-open)。 */
function PairMismatchWarning({ fileA, fileB }: { fileA: File; fileB: File }) {
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // ペアが変わった瞬間に前のペアの判定結果を残さないための同期クリア
    // (ItemThumbnailのobjectURL所有パターンと同じ理由)。計算完了までは
    // 何も表示しない。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDistance(null);
    computePairMismatchDistance(fileA, fileB).then((d) => {
      if (!cancelled) setDistance(d);
    });
    return () => {
      cancelled = true;
    };
  }, [fileA, fileB]);

  if (distance === null || distance <= PAIR_MISMATCH_THRESHOLD) return null;

  return (
    <p className="text-[10px] leading-snug text-amber-600">
      ⚠️ この2枚は別の部屋の可能性があります。同じ部屋の2枚1組かご確認ください
    </p>
  );
}

const pickerButtonClass =
  "inline-block cursor-pointer rounded-xl border border-dashed border-black/20 bg-white/60 px-4 py-3 text-sm font-medium text-[var(--brand-ink)]/80 hover:bg-white/90 hover:border-[var(--brand-orange)]/60 transition-colors";
const chipClass =
  "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer";
const chipActiveClass =
  "border-[var(--brand-orange)] bg-[var(--brand-orange)]/15 text-[var(--brand-orange-dark)]";
const chipInactiveClass =
  "border-black/10 bg-white/60 text-[var(--brand-ink)]/70 hover:bg-white/90";
const moveSelectClass =
  "shrink-0 rounded-md border border-black/10 bg-white/70 px-1 py-0.5 text-[10px] text-[var(--brand-ink)]/70 max-w-[5.5rem]";

/** 部屋名チップ(v3.1: 横スクロール1行)。選択中チップは自動でスクロール
 * 範囲内へ入る(要件1「選択中チップは自動で見える位置へ」)。自由記入
 * inputは「その他」選択時のみ表示(現行踏襲)。 */
function RoomLabelChips({
  uid,
  label,
  customLabelMode,
  busy,
  onSetLabelChip,
  onSetLabelCustomText,
}: {
  uid: string;
  label: string | null;
  customLabelMode: boolean;
  busy: boolean;
  onSetLabelChip: (uid: string, chip: string) => void;
  onSetLabelCustomText: (uid: string, text: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const activeKey = customLabelMode ? ROOM_LABEL_OTHER : label;

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [activeKey]);

  return (
    <div>
      <div className="flex flex-nowrap gap-1.5 overflow-x-auto scroll-smooth pb-1">
        {ROOM_LABEL_CHIPS.map((chip) => {
          const active =
            chip === ROOM_LABEL_OTHER ? customLabelMode : label === chip && !customLabelMode;
          return (
            <button
              key={chip}
              ref={active ? activeRef : undefined}
              type="button"
              disabled={busy}
              onClick={() => onSetLabelChip(uid, chip)}
              className={`${chipClass} ${active ? chipActiveClass : chipInactiveClass}`}
            >
              {chip}
            </button>
          );
        })}
      </div>
      {customLabelMode && (
        <input
          type="text"
          value={label ?? ""}
          disabled={busy}
          onChange={(e) => onSetLabelCustomText(uid, e.target.value)}
          placeholder="部屋名を入力(任意)"
          maxLength={50}
          className="mt-1.5 w-full rounded-lg border border-black/10 bg-white/80 px-3 py-1.5 text-sm text-[var(--brand-ink)] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
        />
      )}
    </div>
  );
}

/** 「他の部屋へ」移動セレクト(v3.1: 小型化・単騎/ペア両方で共用)。
 * フックを持たないプレーンな部品 — 呼び出し側が
 * `onMoveItemToRoom && rooms.length > 1` を確認してから描画する
 * (自動ペアリング確認画面=bulkモード専用。design.md「自動ペアリング
 * 確認UI実装spec」)。 */
function MoveToRoomSelect({
  rooms,
  fromUid,
  itemIdx,
  busy,
  onMoveItemToRoom,
}: {
  rooms: RoomCardState[];
  fromUid: string;
  itemIdx: number;
  busy: boolean;
  onMoveItemToRoom: (fromUid: string, itemIdx: number, toUid: string) => void;
}) {
  return (
    <select
      aria-label="別の部屋へ移動"
      disabled={busy}
      value=""
      onChange={(e) => {
        const targetUid = e.target.value;
        if (targetUid) onMoveItemToRoom(fromUid, itemIdx, targetUid);
        e.target.value = "";
      }}
      className={moveSelectClass}
    >
      <option value="">他の部屋へ</option>
      {rooms
        .filter((r) => r.uid !== fromUid)
        .map((r) => (
          <option key={r.uid} value={r.uid}>
            {r.label ?? `部屋${rooms.findIndex((x) => x.uid === r.uid) + 1}`}
          </option>
        ))}
    </select>
  );
}

/** ペア写真1枚分(サムネ+オーバーレイバッジ+削除+移動)。v3.1改修A②。 */
function PairPhoto({
  room,
  rooms,
  item,
  itemIdx,
  frameLabel,
  busy,
  onRemoveItem,
  onMoveItemToRoom,
}: {
  room: RoomCardState;
  rooms: RoomCardState[];
  item: RoomLocalPhotoItem;
  itemIdx: number;
  frameLabel: string;
  busy: boolean;
  onRemoveItem: (uid: string, itemIdx: number) => void;
  onMoveItemToRoom?: (fromUid: string, itemIdx: number, toUid: string) => void;
}) {
  return (
    <div
      className="min-w-0 flex-1"
      draggable={!!onMoveItemToRoom && !busy}
      onDragStart={
        onMoveItemToRoom
          ? (e) => {
              e.dataTransfer.setData(
                "text/plain",
                JSON.stringify({ uid: room.uid, itemIdx })
              );
            }
          : undefined
      }
    >
      <div className="relative">
        <ItemThumbnail file={item.file} kind="photo" className={`${thumbClassPair} w-full`} />
        <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          {frameLabel}
        </span>
        {!busy && (
          <button
            type="button"
            onClick={() => onRemoveItem(room.uid, itemIdx)}
            aria-label="削除"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] leading-none text-white"
          >
            ×
          </button>
        )}
      </div>
      <p className="mt-1 truncate text-[10px] text-[var(--brand-ink)]/60">
        {item.file.name} · {formatBytes(item.file.size)}
        {item.lowRes === true ? " · ⚠粗め" : ""}
      </p>
      {onMoveItemToRoom && rooms.length > 1 && (
        <MoveToRoomSelect
          rooms={rooms}
          fromUid={room.uid}
          itemIdx={itemIdx}
          busy={busy}
          onMoveItemToRoom={onMoveItemToRoom}
        />
      )}
    </div>
  );
}

/** ペア(写真2枚)の横並びブロック。v3.1改修A②+改修B(妥当性警告)。 */
function PairPhotosBlock({
  room,
  rooms,
  busy,
  onRemoveItem,
  onSwapFrames,
  onUnpairRoom,
  onMoveItemToRoom,
}: {
  room: RoomCardState;
  rooms: RoomCardState[];
  busy: boolean;
  onRemoveItem: (uid: string, itemIdx: number) => void;
  onSwapFrames: (uid: string) => void;
  onUnpairRoom?: (uid: string) => void;
  onMoveItemToRoom?: (fromUid: string, itemIdx: number, toUid: string) => void;
}) {
  const first = room.items[0];
  const second = room.items[1];
  if (first.kind !== "photo" || second.kind !== "photo") return null;

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1.5">
        <PairPhoto
          room={room}
          rooms={rooms}
          item={first}
          itemIdx={0}
          frameLabel="始まり"
          busy={busy}
          onRemoveItem={onRemoveItem}
          onMoveItemToRoom={onMoveItemToRoom}
        />
        <span className="shrink-0 pt-7 text-sm text-black/25" aria-hidden>
          →
        </span>
        <PairPhoto
          room={room}
          rooms={rooms}
          item={second}
          itemIdx={1}
          frameLabel="終わり"
          busy={busy}
          onRemoveItem={onRemoveItem}
          onMoveItemToRoom={onMoveItemToRoom}
        />
      </div>
      <PairMismatchWarning fileA={first.file} fileB={second.file} />
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--brand-gray-light)]">
        <span className="truncate">この順に映像が動きます</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {onUnpairRoom && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onUnpairRoom(room.uid)}
              className="rounded-md border border-black/10 bg-white/70 px-1.5 py-0.5 text-[var(--brand-ink)]/70 hover:bg-white transition-colors"
            >
              ペア解除
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onSwapFrames(room.uid)}
            className="rounded-md border border-black/10 bg-white/70 px-1.5 py-0.5 text-[var(--brand-ink)]/70 hover:bg-white transition-colors"
          >
            ↕ 入替
          </button>
        </div>
      </div>
    </div>
  );
}

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
  // 自動ペアリング確認画面(SubmitFormのbulk確認モード)専用の追加操作。
  // 未指定(=手動カードモード/Phase A)の間は何も描画しない — 既存の
  // 手動カードUIは1行も変わらない(design.md「確認UI実装spec」)。
  onMoveItemToRoom?: (fromUid: string, itemIdx: number, toUid: string) => void;
  onUnpairRoom?: (uid: string) => void;
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
  onMoveItemToRoom,
  onUnpairRoom,
}: RoomCardsFieldProps) {
  return (
    <div className="space-y-2">
      {rooms.length === 0 && (
        <p className="text-xs text-[var(--brand-gray-light)]">
          「部屋を追加」から、部屋ごとに写真(1〜2枚)または動画(1本)を追加してください。
        </p>
      )}

      {rooms.map((room, idx) => {
        const hasVideo = room.items.some((it) => it.kind === "video");
        const photoCount = room.items.filter((it) => it.kind === "photo").length;
        const canAddPhoto = !hasVideo && photoCount < MAX_ROOM_PHOTOS_PER_CARD;
        const isPair = room.items.length === 2 && room.items.every((it) => it.kind === "photo");

        return (
          <div
            key={room.uid}
            className="rounded-xl border border-black/10 bg-white/60 p-3 space-y-2"
            onDragOver={onMoveItemToRoom ? (e) => e.preventDefault() : undefined}
            onDrop={
              onMoveItemToRoom
                ? (e) => {
                    e.preventDefault();
                    try {
                      const raw = e.dataTransfer.getData("text/plain");
                      const data = raw ? (JSON.parse(raw) as { uid?: string; itemIdx?: number }) : null;
                      if (data?.uid && typeof data.itemIdx === "number") {
                        onMoveItemToRoom(data.uid, data.itemIdx, room.uid);
                      }
                    } catch {
                      // 不正なドロップデータは無視(fail-soft)
                    }
                  }
                : undefined
            }
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
                  className="rounded-md border border-black/10 bg-white/70 px-1.5 py-0.5 text-[11px] text-[var(--brand-ink)]/70 disabled:opacity-30 hover:bg-white transition-colors"
                  aria-label="上へ移動"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={busy || idx === rooms.length - 1}
                  onClick={() => onMoveRoom(room.uid, 1)}
                  className="rounded-md border border-black/10 bg-white/70 px-1.5 py-0.5 text-[11px] text-[var(--brand-ink)]/70 disabled:opacity-30 hover:bg-white transition-colors"
                  aria-label="下へ移動"
                >
                  ↓
                </button>
                {!busy && (
                  <button
                    type="button"
                    onClick={() => onRemoveRoom(room.uid)}
                    className="ml-1 text-[11px] text-red-500 hover:text-red-600"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>

            {/* 部屋名(任意・チップ+自由記入・v3.1: 横スクロール1行) */}
            <RoomLabelChips
              uid={room.uid}
              label={room.label}
              customLabelMode={room.customLabelMode}
              busy={busy}
              onSetLabelChip={onSetLabelChip}
              onSetLabelCustomText={onSetLabelCustomText}
            />

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

            {/* ペア(写真2枚): 横並び+オーバーレイバッジ(v3.1改修A②) */}
            {isPair && (
              <PairPhotosBlock
                room={room}
                rooms={rooms}
                busy={busy}
                onRemoveItem={onRemoveItem}
                onSwapFrames={onSwapFrames}
                onUnpairRoom={onUnpairRoom}
                onMoveItemToRoom={onMoveItemToRoom}
              />
            )}

            {/* 単騎(写真1枚)/動画1本: 縦積みリスト(旧UIを圧縮して踏襲) */}
            {room.items.length > 0 && !isPair && (
              <ul className="space-y-1">
                {room.items.map((it, ii) => {
                  // 「始まり」は写真のみの部屋なら1枚時点でも付与する
                  // (入稿UI仕様v3: 2枚1組が既定=1枚目は常に「始まり」扱い)。
                  // 動画が入る部屋には付けない。
                  const frameLabel = it.kind === "photo" && !hasVideo ? "始まり" : null;
                  return (
                    <li
                      key={`${it.file.name}-${it.file.size}-${ii}`}
                      className="rounded-lg bg-white/70 border border-black/5 px-2.5 py-2"
                      draggable={!!onMoveItemToRoom && !busy}
                      onDragStart={
                        onMoveItemToRoom
                          ? (e) => {
                              e.dataTransfer.setData(
                                "text/plain",
                                JSON.stringify({ uid: room.uid, itemIdx: ii })
                              );
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-start gap-2">
                        <ItemThumbnail file={it.file} kind={it.kind} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            {frameLabel && (
                              <span className="shrink-0 rounded-full bg-[var(--brand-orange)]/15 text-[var(--brand-orange-dark)] text-[9px] font-semibold px-1.5 py-0.5">
                                {frameLabel}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-xs text-[var(--brand-ink)]">
                              {it.file.name}
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--brand-gray-light)]">
                              {formatBytes(it.file.size)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {onMoveItemToRoom && rooms.length > 1 && (
                              <MoveToRoomSelect
                                rooms={rooms}
                                fromUid={room.uid}
                                itemIdx={ii}
                                busy={busy}
                                onMoveItemToRoom={onMoveItemToRoom}
                              />
                            )}
                            {it.kind === "photo" && it.lowRes === true && (
                              <span className="text-[10px] text-amber-600">
                                ⚠ 画質粗め(送信可)
                              </span>
                            )}
                            {it.kind === "video" && it.durationSec !== null && (
                              <span className="text-[10px] text-[var(--brand-gray-light)]">
                                約{Math.round(it.durationSec)}秒・1080p推奨
                              </span>
                            )}
                          </div>
                        </div>
                        {!busy && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(room.uid, ii)}
                            className="text-[11px] text-red-500 hover:text-red-600 shrink-0"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* 空の「終わり」スロット(入稿UI仕様v3要件3)。1枚部屋は
                例外フォールバック — 2枚1組が基本であることを常に明示する。 */}
            {room.items.length === 1 && canAddPhoto && (
              <label className="flex items-center gap-2.5 rounded-lg border-2 border-dashed border-black/15 bg-white/30 px-2.5 py-2 cursor-pointer hover:bg-white/50 transition-colors">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-black/20 text-xl text-black/25">
                  +
                </span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block w-fit rounded-full bg-black/5 text-[var(--brand-ink)]/40 text-[9px] font-semibold px-1.5 py-0.5">
                    終わり
                  </span>
                  <span className="block text-xs font-medium text-[var(--brand-orange-dark)]">
                    + 2枚目を追加
                  </span>
                  <span className="block text-[10px] text-[var(--brand-gray-light)]">
                    2枚1組が基本です(1枚でも可)
                  </span>
                </span>
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
              <p className="text-[10px] text-[var(--brand-gray-light)]">
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
