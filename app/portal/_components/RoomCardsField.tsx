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
//
// v3.3(2026-07-31・始まり/終わり入替ボタンの移設): ④で操作列に集約した
// 「↕ 入替」は、サムネを見て直感的に押したい操作なのに下段に埋もれて
// 発見しづらかった。2枚のサムネの間(旧: 装飾の→のみ)を⇄アイコンの
// 実ボタンに置き換え、操作列からは撤去(PairPhotosBlock参照)。state更新
// は既存のonSwapFrames(=SubmitForm.tsx swapRoomFrames)をそのまま流用 —
// 新しいstateは増やしていない。

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useRoomItemDrag, type RoomItemRef } from "@/app/portal/_lib/useRoomItemDrag";
import VideoVisionWarning from "./VideoVisionWarning";

// v3.1段2(2026-07-21・写真タイルのポインタDnD): dnd bundleの型は
// useRoomItemDrag の戻り値からそのまま導出する(enabledだけこちらで足す)。
// PairPhoto/PairPhotosBlockはこのbundleを1個のpropとして受け取り、内部で
// activeItem/dropTargetを見て自分がドラッグ元/ドロップ先かを判定する。
type RoomDnd = ReturnType<typeof useRoomItemDrag> & { enabled: boolean };

// v3.1段3: mutedPairKeysの安定した既定値(advancedモード等・未指定時)。
// 毎レンダー新しいSetを作ると無駄な参照変化を生むため module スコープの
// 1個を使い回す(中身は常に空・書き換えない)。
const EMPTY_MUTED_PAIR_KEYS = new Set<string>();

// v3.2(2026-07-22・PCレイアウト対応・design.md「v3.2仕様」): TailwindのMD
// lg ブレークポイント(1024px)と同じ値をJS側の判定にも使う。CSSメディア
// クエリだけでは「アコーディオンの展開state」というJS側の状態と絡むため、
// window.matchMedia の変化を isDesktop として state化する方式を採用
// (指示どおり)。
const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

/** 現在のビューポートがlg+かどうか。SSR/初回レンダーは常にfalse(モバイル
 * 優先のフォールバック)— マウント後のeffectで実際の値へ即補正する(既存
 * のItemThumbnail等と同じ「SSRはfalse/マウント後に同期set」パターン)。
 * matchMediaの"change"イベントを購読するため、リサイズでlgを跨いでも
 * (縮小/拡大どちらの向きでも)追随する。 */
function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
    // マウント直後に実際のビューポート幅を反映するための同期set(SSR時の
    // false初期値をクライアントの実値へ即補正する。ItemThumbnailの
    // objectURL所有パターンと同じ理由で意図的)。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

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
      // draggable=false: <img>はブラウザ標準でドラッグ可能なため、押して
      // 動かした瞬間にHTML5ネイティブドラッグが始まりPointer Eventsが
      // pointercancelで打ち切られる(=useRoomItemDragが一切発火しない)。
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" draggable={false} className={className} />
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

// --- v3.1段3(2026-07-21・アコーディオン+誤ペア警告のアクション格上げ)---

function fileIdentityKey(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`;
}

/** ペアの恒久ミュートキー。2ファイルの実体(name+size+lastModified)から
 * 順序非依存で安定した文字列を作る — 「始まり/終わり」の位置が入れ替わって
 * も同じ組は同じキーになり(=組み替えでミュートが復活しない)、どちらか
 * 一方でも別ファイルに置き換われば別キーになる(=別の組は再判定される)。
 * ミュート集合自体はSubmitForm側のstate(mutedPairKeys)で保持する — この
 * コンポーネントがアンマウント/再マウントされても消えない。 */
function pairMuteKey(fileA: File, fileB: File): string {
  const [a, b] = [fileIdentityKey(fileA), fileIdentityKey(fileB)].sort();
  return `${a}|${b}`;
}

/** ペア妥当性の判定を折りたたみ中も止めずに実行する非表示コンポーネント。
 * bulk確認モード(dnd.enabled)のときだけ、ペア部屋ごとに1個だけ常時マウント
 * する(展開/折りたたみの表示切り替えとは無関係に描画し続ける=判定
 * stateが消えないようにするための資産)。結果は onChange 経由で親
 * (RoomCardsField)の mismatchByUid へ集約し、折りたたみ行の⚠アイコンと
 * 展開時のアクションUIの双方が同じ結果を参照する(二重計算しない)。 */
function PairMismatchTracker({
  uid,
  fileA,
  fileB,
  onChange,
}: {
  uid: string;
  fileA: File;
  fileB: File;
  onChange: (uid: string, mismatched: boolean) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    computePairMismatchDistance(fileA, fileB).then((d) => {
      if (!cancelled) onChange(uid, d !== null && d > PAIR_MISMATCH_THRESHOLD);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, fileA, fileB, onChange]);

  return null;
}

/** 誤ペア警告のアクション二択(v3.1段3 要件2「警告→分岐点」)。bulk確認
 * モードでのみ使用(advancedモードは既存の PairMismatchWarning のまま —
 * このコンポーネントには触れない)。「同じ部屋です」はミュート(恒久・
 * ファイル実体キー)、「別々の部屋に分ける」は既存 onUnpairRoom を1タップ
 * 発動(1枚×2部屋分割・部屋名引き継ぎは実装済み)。onUnpair未提供時は
 * そのボタンだけ出さない(既存の「ペア解除」ボタンと同じ gating 流儀)。 */
function PairMismatchAction({
  busy,
  onMute,
  onUnpair,
}: {
  busy: boolean;
  onMute: () => void;
  onUnpair?: () => void;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
      <p className="text-[10px] leading-snug text-amber-700">
        ⚠ この2枚は別の部屋のようです
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onMute}
          className="rounded-md border border-amber-300 bg-white/80 px-2 py-1 text-[10px] font-medium text-amber-800 transition-colors hover:bg-white disabled:opacity-50"
        >
          同じ部屋です(このまま)
        </button>
        {onUnpair && (
          <button
            type="button"
            disabled={busy}
            onClick={onUnpair}
            className="rounded-md border border-amber-300 bg-white/80 px-2 py-1 text-[10px] font-medium text-amber-800 transition-colors hover:bg-white disabled:opacity-50"
          >
            別々の部屋に分ける
          </button>
        )}
      </div>
    </div>
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

/** ペア写真1枚分(サムネ+オーバーレイバッジ+削除+移動)。v3.1改修A②。
 * v3.1段2: 旧HTML5 native drag(draggable/onDragStart)はタッチで動かない
 * ため撤去し、useRoomItemDrag(Pointer Events)へ完全に置き換えた(二重
 * 発火防止・design.md「UI v3.1改修+誤ペア三重ガード」段2)。ドラッグの
 * 掴み手/ドロップ先(data-drop-photo)は「relative」div(サムネ+バッジ+
 * 削除ボタン)に限定 — ファイル名/移動セレクトはドラッグ対象外にすることで
 * タップ操作(削除ボタン・セレクト)と衝突しない。 */
function PairPhoto({
  room,
  rooms,
  item,
  itemIdx,
  frameLabel,
  busy,
  dnd,
  onRemoveItem,
  onMoveItemToRoom,
}: {
  room: RoomCardState;
  rooms: RoomCardState[];
  item: RoomLocalPhotoItem;
  itemIdx: number;
  frameLabel: string;
  busy: boolean;
  dnd: RoomDnd;
  onRemoveItem: (uid: string, itemIdx: number) => void;
  onMoveItemToRoom?: (fromUid: string, itemIdx: number, toUid: string) => void;
}) {
  const dragKey: RoomItemRef = { uid: room.uid, itemIdx };
  const isDragging =
    dnd.enabled && dnd.activeItem?.uid === room.uid && dnd.activeItem?.itemIdx === itemIdx;
  const isSwapTarget =
    dnd.enabled &&
    dnd.dropTarget?.kind === "swap" &&
    dnd.dropTarget.uid === room.uid &&
    dnd.dropTarget.itemIdx === itemIdx;
  const handleProps = dnd.enabled && !busy ? dnd.getHandleProps(dragKey) : {};

  return (
    <div className={`min-w-0 flex-1 ${isDragging ? "opacity-30" : ""}`}>
      <div
        className={`relative ${dnd.enabled && !busy ? "cursor-grab active:cursor-grabbing" : ""} ${
          isSwapTarget ? "rounded-lg ring-2 ring-[var(--brand-orange)] ring-offset-2" : ""
        }`}
        data-drop-photo={dnd.enabled ? `${room.uid}:${itemIdx}` : undefined}
        {...handleProps}
      >
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
  dnd,
  isMismatchActive,
  mismatchKey,
  onRemoveItem,
  onSwapFrames,
  onUnpairRoom,
  onMoveItemToRoom,
  onMutePair,
}: {
  room: RoomCardState;
  rooms: RoomCardState[];
  busy: boolean;
  dnd: RoomDnd;
  // v3.1段3: 事前計算済みの誤ペア判定(mismatchByUid由来・dnd.enabled時
  // のみ意味を持つ)。ミュート済みなら呼び出し側(RoomCardsField)側で
  // 既に false になっている。
  isMismatchActive: boolean;
  mismatchKey: string | null;
  onRemoveItem: (uid: string, itemIdx: number) => void;
  onSwapFrames: (uid: string) => void;
  onUnpairRoom?: (uid: string) => void;
  onMoveItemToRoom?: (fromUid: string, itemIdx: number, toUid: string) => void;
  onMutePair?: (key: string) => void;
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
          dnd={dnd}
          onRemoveItem={onRemoveItem}
          onMoveItemToRoom={onMoveItemToRoom}
        />
        {/* v3.3(2026-07-31・始まり/終わり入替ボタンをサムネ間へ移設)。
            旧「↕ 入替」は下の操作列にあり見つけづらかった — 顧客が
            サムネを見て直感的に押せるよう、2枚の間の視覚的な区切り
            (旧は装飾の→のみ)を実際に押せるボタンへ置き換えた。
            44x44px(h-11 w-11)でタップ領域を確保・stateは既存の
            onSwapFrames(=swapRoomFrames)をそのまま流用する。 */}
        <button
          type="button"
          disabled={busy}
          onClick={() => onSwapFrames(room.uid)}
          aria-label="始まりと終わりを入れ替える"
          title="始まりと終わりを入れ替える"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border border-black/10 bg-white/80 text-base text-[var(--brand-ink)]/70 transition-colors hover:border-[var(--brand-orange)]/60 hover:bg-white disabled:opacity-50"
        >
          ⇄
        </button>
        <PairPhoto
          room={room}
          rooms={rooms}
          item={second}
          itemIdx={1}
          frameLabel="終わり"
          busy={busy}
          dnd={dnd}
          onRemoveItem={onRemoveItem}
          onMoveItemToRoom={onMoveItemToRoom}
        />
      </div>
      {dnd.enabled ? (
        // bulk確認モード: アクション二択(v3.1段3)。advancedモードの
        // PairMismatchWarning(下のelse節)には一切触れない。
        isMismatchActive &&
        mismatchKey && (
          <PairMismatchAction
            busy={busy}
            onMute={() => onMutePair?.(mismatchKey)}
            onUnpair={onUnpairRoom ? () => onUnpairRoom(room.uid) : undefined}
          />
        )
      ) : (
        <PairMismatchWarning fileA={first.file} fileB={second.file} />
      )}
      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--brand-gray-light)]">
        <span className="truncate">この順に映像が動きます</span>
        {onUnpairRoom && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onUnpairRoom(room.uid)}
            className="shrink-0 rounded-md border border-black/10 bg-white/70 px-1.5 py-0.5 text-[var(--brand-ink)]/70 hover:bg-white transition-colors"
          >
            ペア解除
          </button>
        )}
      </div>
    </div>
  );
}

/** アコーディオン折りたたみ行(v3.1段3・bulk確認モードのみ)。高さ約48px
 * 目安 — 部屋番号+部屋名+ミニサムネ+状態アイコンだけの要約1行。data-drop-room
 * は親(このコンポーネントを包む外側div)側が既に持っているため、ここでは
 * 何も付けない — 折りたたみ中でも外側divへドロップすれば移動先として
 * 機能する(要件どおり)。クリックで展開するだけの薄いボタン — DnDの
 * pointerdownハンドルはここには一切付いていない(ドラッグはPairPhoto等の
 * サムネハンドルからのみ開始する設計のため競合しない)。 */
function CollapsedRoomRow({
  idx,
  room,
  hasMismatch,
  onExpand,
}: {
  idx: number;
  room: RoomCardState;
  hasMismatch: boolean;
  onExpand: () => void;
}) {
  const hasVideo = room.items.some((it) => it.kind === "video");
  const isSingle = room.items.length === 1 && !hasVideo;

  return (
    <button type="button" onClick={onExpand} className="flex w-full items-center gap-2 text-left">
      <span className="w-4 shrink-0 text-center text-xs font-bold text-[var(--brand-ink)]/50">
        {idx + 1}
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {hasVideo ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md bg-black/5 text-sm"
            aria-hidden
          >
            🎬
          </span>
        ) : room.items.length === 0 ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-black/15 text-xs text-black/25"
            aria-hidden
          >
            +
          </span>
        ) : (
          room.items.map((it, ii) =>
            it.kind === "photo" ? (
              <ItemThumbnail
                key={ii}
                file={it.file}
                kind="photo"
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-black/10 bg-black/5"
              />
            ) : null
          )
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--brand-ink)]">
        {room.label ?? `部屋${idx + 1}`}
      </span>
      {hasMismatch && (
        <span className="shrink-0 text-xs text-amber-600" aria-hidden title="別の部屋の可能性">
          ⚠
        </span>
      )}
      {isSingle && (
        <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] text-[var(--brand-ink)]/50">
          1枚
        </span>
      )}
      <span className="shrink-0 text-[10px] text-black/30" aria-hidden>
        ▸
      </span>
    </button>
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
  /** モニタープラン(2026-08-24): 動画素材だけで作る契約。写真の投入口を
   * 閉じる。BulkRoomIntake 側の写真タブ封鎖と同じ判断で、こちらは手動で
   * 部屋を作るモードの投入口を塞ぐ(両方閉じて初めて「写真を入れられない
   * UI」になる)。 */
  videoOnly?: boolean;
  onRemoveItem: (uid: string, itemIdx: number) => void;
  onSwapFrames: (uid: string) => void;
  // 自動ペアリング確認画面(SubmitFormのbulk確認モード)専用の追加操作。
  // 未指定(=手動カードモード/Phase A)の間は何も描画しない — 既存の
  // 手動カードUIは1行も変わらない(design.md「確認UI実装spec」)。
  onMoveItemToRoom?: (fromUid: string, itemIdx: number, toUid: string) => void;
  onUnpairRoom?: (uid: string) => void;
  // v3.1段2(2026-07-21・写真タイルのポインタDnD)。onMoveItemToRoomと同じ
  // gating(bulk確認モードでのみ有効)— 未指定の間はドラッグハンドル自体を
  // 描画しない。
  onSwapItems?: (
    a: { uid: string; itemIdx: number },
    b: { uid: string; itemIdx: number }
  ) => void;
  // v3.1段3(2026-07-21・誤ペア警告のアクション格上げ)。onMoveItemToRoomと
  // 同じgating(bulk確認モードのみ)— 未指定の間はPairPhotosBlockが
  // advancedモードの旧PairMismatchWarningのままになる(上のPairPhotosBlock
  // 内 dnd.enabled 分岐参照)。
  mutedPairKeys?: Set<string>;
  onMutePair?: (key: string) => void;
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
  onSwapItems,
  mutedPairKeys = EMPTY_MUTED_PAIR_KEYS,
  onMutePair,
  videoOnly = false,
}: RoomCardsFieldProps) {
  // v3.1段2: DnDはonMoveItemToRoomと同じ場面(bulk確認モード)でのみ有効
  // (design.md方針=段1以前の「移動セレクトが使える場面」を1行も広げない)。
  const dndEnabled = !!onMoveItemToRoom;
  // v3.1段3: アコーディオン(改修1)・誤ペア警告のアクション格上げ(改修2)
  // も同じ判断基準を流用する — 「bulk確認モードでのみ」という要件はこの
  // 既存gatingとぴったり一致するため、新しいpropを増やさない。
  const accordionEnabled = dndEnabled;

  // v3.2: lg+ではアコーディオンを無効化して全カード常時展開+2列グリッド
  // にする(design.md「v3.2仕様」— 畳みはスマホの生存戦略・PCは一覧性
  // 優先)。advanced/bulk確認モードどちらの部屋カードにも適用する(段3の
  // accordionEnabled/dnd.enabledのゲートとは独立 — こちらはモード非依存)。
  const isDesktop = useIsDesktopViewport();

  // アコーディオン: 展開中の部屋は1つだけ。新しい部屋が追加されたら自動で
  // それを展開する(最後に触った部屋を展開が自然=design.md v3.1段3仕様)。
  // 展開中の部屋が消えた(削除/移動で空になった等)場合は折りたたみへ戻す。
  // advancedモード(accordionEnabled=false)ではこのstateは未使用のまま
  // (isExpanded判定側でaccordionEnabled自体を先に見るため参照されない)。
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const prevRoomUidsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!accordionEnabled) return;
    const uids = rooms.map((r) => r.uid);
    const uidSet = new Set(uids);
    const prevUids = prevRoomUidsRef.current;
    if (prevUids === null) {
      // 初回マウント時、まだ何も展開していなければ最初の部屋を開く
      // (rooms propが親から来る値のため「前回のuid集合」との比較でしか
      // 新規判定できない=このeffectでの同期setStateが必要。ItemThumbnail
      // のobjectURL所有パターンと同じ理由で意図的)。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (uids.length > 0) setExpandedUid((cur) => cur ?? uids[0]);
    } else {
      const added = uids.filter((uid) => !prevUids.has(uid));
      if (added.length > 0) {
        // 新規追加された部屋(bulk一括投入含む)を自動展開する
        // (design.md v3.1段3仕様「最後に触った部屋を展開が自然」)。
        setExpandedUid(added[added.length - 1]);
      } else {
        // 展開中の部屋が消えた(削除/移動で空になった等)場合だけ折りたたみへ
        // 戻す(それ以外は現状維持=関数更新のため無駄な再レンダーもない)。
        setExpandedUid((cur) => (cur && !uidSet.has(cur) ? null : cur));
      }
    }
    prevRoomUidsRef.current = uidSet;
  }, [rooms, accordionEnabled]);

  // 誤ペア判定(v3.1段3改修2)。PairMismatchTrackerが折りたたみ中も常時
  // マウントされ続けてここへ結果を集約する(uid -> 判定結果の低頻度state)。
  const [mismatchByUid, setMismatchByUid] = useState<Record<string, boolean>>({});
  const handleMismatchChange = useCallback((uid: string, mismatched: boolean) => {
    setMismatchByUid((prev) => (prev[uid] === mismatched ? prev : { ...prev, [uid]: mismatched }));
  }, []);

  // 部屋本体へのドロップ(move)を許可してよいかの判定。moveRoomItemToRoom
  // 内の実バリデーション(SubmitForm.tsx)と同じルール(動画は空部屋のみ/
  // 写真は動画のない部屋かつ2枚未満)をハイライト表示専用に複製している
  // — 実際の確定処理・エラー表示は既存ハンドラ側に一本化したまま
  // (ここでの誤判定があっても実処理側のガードが最終防波堤)。
  function isValidMoveTarget(from: RoomItemRef, toUid: string): boolean {
    const fromRoom = rooms.find((r) => r.uid === from.uid);
    const toRoom = rooms.find((r) => r.uid === toUid);
    const item = fromRoom?.items[from.itemIdx];
    if (!item || !toRoom) return false;
    if (item.kind === "video") return toRoom.items.length === 0;
    if (toRoom.items.some((it) => it.kind === "video")) return false;
    return toRoom.items.length < MAX_ROOM_PHOTOS_PER_CARD;
  }

  const { activeItem, dropTarget, getHandleProps } = useRoomItemDrag({
    onSwap: (a, b) => onSwapItems?.(a, b),
    onMove: (from, toUid) => onMoveItemToRoom?.(from.uid, from.itemIdx, toUid),
    isValidMoveTarget,
    disabled: busy || !dndEnabled,
  });
  const dnd: RoomDnd = { enabled: dndEnabled, activeItem, dropTarget, getHandleProps };

  return (
    // v3.2: lg+で部屋カードを2列グリッド化(space-y-2はモバイル専用の
    // 縦積み間隔・lg+ではgap-3に置き換える)。DnDのdata-drop-room/
    // data-drop-photoは各カード自身のdivに付いたまま(このコンテナの
    // レイアウト変更とは無関係)なので、elementFromPoint方式のドロップ
    // 判定は列をまたいでも無改修で機能する。
    <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
      {rooms.length === 0 && (
        <p className="text-xs text-[var(--brand-gray-light)] lg:col-span-2">
          「部屋を追加」から、部屋ごとに写真(1〜2枚)または動画(1本)を追加してください。
        </p>
      )}

      {rooms.map((room, idx) => {
        const hasVideo = room.items.some((it) => it.kind === "video");
        const photoCount = room.items.filter((it) => it.kind === "photo").length;
        const canAddPhoto = !hasVideo && photoCount < MAX_ROOM_PHOTOS_PER_CARD;
        const isPair = room.items.length === 2 && room.items.every((it) => it.kind === "photo");

        // v3.1段3改修2: ペアの恒久ミュートキー+誤ペア判定の事前計算
        // (mismatchByUidはPairMismatchTrackerが常時マウントされて埋める —
        // 折りたたみ中も計算が止まらないための設計・下のtracker参照)。
        const pairFiles: [File, File] | null =
          isPair && room.items[0].kind === "photo" && room.items[1].kind === "photo"
            ? [room.items[0].file, room.items[1].file]
            : null;
        const mismatchKeyForRoom = pairFiles ? pairMuteKey(pairFiles[0], pairFiles[1]) : null;
        const isMismatchActive =
          dnd.enabled &&
          !!pairFiles &&
          mismatchByUid[room.uid] === true &&
          !(mismatchKeyForRoom !== null && mutedPairKeys.has(mismatchKeyForRoom));

        // v3.1段3改修1: アコーディオン。advancedモード(accordionEnabled=
        // false)では常にtrue=フル表示のまま(既存挙動を1行も変えない)。
        // v3.2: lg+はisDesktopがtrueになり、accordionEnabled/expandedUidの
        // 値に関わらず常にフル展開(design.md「v3.2仕様」PCは一覧性優先)。
        const isExpanded = !accordionEnabled || isDesktop || expandedUid === room.uid;

        // v3.1段2: 部屋本体への「move」ドロップ先ハイライト(有効な受け先
        // だけ・上のisValidMoveTarget参照)。旧HTML5 native drag
        // (onDragOver/onDrop)はここで撤去 — useRoomItemDragのpointerup
        // ハンドラがonMoveItemToRoomを直接呼ぶため、二重発火の余地はない。
        const isRoomMoveTarget =
          dnd.enabled && dropTarget?.kind === "move" && dropTarget.uid === room.uid;

        return (
          <div
            key={room.uid}
            data-drop-room={dnd.enabled ? room.uid : undefined}
            className={`rounded-xl border transition-colors ${isExpanded ? "p-3 space-y-2" : "p-2"} ${
              isRoomMoveTarget
                ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 ring-2 ring-[var(--brand-orange)]"
                : "border-black/10 bg-white/60"
            }`}
          >
            {/* v3.1段3: 誤ペア判定は展開/折りたたみに関係なく常時マウント
                (要件「折りたたみ中も生かす」)。何も描画しない — 結果は
                mismatchByUid経由でCollapsedRoomRowの⚠アイコン/展開時の
                PairMismatchActionの両方が参照する。 */}
            {dnd.enabled && pairFiles && (
              <PairMismatchTracker
                uid={room.uid}
                fileA={pairFiles[0]}
                fileB={pairFiles[1]}
                onChange={handleMismatchChange}
              />
            )}

            {accordionEnabled && !isExpanded ? (
              <CollapsedRoomRow
                idx={idx}
                room={room}
                hasMismatch={isMismatchActive}
                onExpand={() => setExpandedUid(room.uid)}
              />
            ) : (
              <>
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
                {videoOnly ? (
                  // モニタープラン: 写真の投入口は開かない。押せないボタンを
                  // 残すより、なぜ使えないかを示すほうが問い合わせが減る。
                  <span
                    className={`${pickerButtonClass} cursor-not-allowed opacity-45`}
                    title="写真から作る機能は、スタンダードプラン以上でご利用いただけます"
                  >
                    🔒 写真はスタンダードプラン以上
                  </span>
                ) : (
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
                )}
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
                dnd={dnd}
                isMismatchActive={isMismatchActive}
                mismatchKey={mismatchKeyForRoom}
                onRemoveItem={onRemoveItem}
                onSwapFrames={onSwapFrames}
                onUnpairRoom={onUnpairRoom}
                onMoveItemToRoom={onMoveItemToRoom}
                onMutePair={onMutePair}
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
                  // v3.1段2: DnD対象は写真タイルのみ(動画は対象外・旧
                  // draggable/onDragStartはここで撤去=native dragとの
                  // 二重発火防止)。
                  const isPhotoTile = it.kind === "photo";
                  const dragKey: RoomItemRef = { uid: room.uid, itemIdx: ii };
                  const isDragging =
                    isPhotoTile &&
                    dnd.enabled &&
                    dnd.activeItem?.uid === room.uid &&
                    dnd.activeItem?.itemIdx === ii;
                  const isSwapTarget =
                    isPhotoTile &&
                    dnd.enabled &&
                    dnd.dropTarget?.kind === "swap" &&
                    dnd.dropTarget.uid === room.uid &&
                    dnd.dropTarget.itemIdx === ii;
                  const handleProps =
                    isPhotoTile && dnd.enabled && !busy ? dnd.getHandleProps(dragKey) : {};
                  return (
                    <li
                      key={`${it.file.name}-${it.file.size}-${ii}`}
                      className={`rounded-lg bg-white/70 border border-black/5 px-2.5 py-2 ${
                        isDragging ? "opacity-30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`shrink-0 ${
                            isPhotoTile && dnd.enabled && !busy ? "cursor-grab active:cursor-grabbing" : ""
                          } ${isSwapTarget ? "rounded-lg ring-2 ring-[var(--brand-orange)] ring-offset-2" : ""}`}
                          data-drop-photo={isPhotoTile && dnd.enabled ? `${room.uid}:${ii}` : undefined}
                          {...handleProps}
                        >
                          <ItemThumbnail file={it.file} kind={it.kind} />
                        </div>
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
                            {/* 短すぎるクリップの警告(2026-08-07 岡本「短すぎるのも悪」)。
                                ナレーションの尺に足りないクリップは映像側をスロー再生して
                                埋めるため、極端に短いと不自然になる。撮り直しは強制せず
                                注意喚起のみ(送信は妨げない)。 */}
                            {it.kind === "video" &&
                              it.durationSec !== null &&
                              it.durationSec < 4 && (
                                <span className="text-[10px] font-semibold text-amber-600">
                                  ⚠ 短めです。5〜10秒だと自然に仕上がります
                                </span>
                              )}
                            {it.kind === "video" && (
                              <VideoVisionWarning
                                file={it.file}
                                label={room.customLabelMode ? null : room.label}
                              />
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
              </>
            )}
          </div>
        );
      })}

      <button
        type="button"
        disabled={busy || rooms.length >= MAX_ROOMS}
        onClick={onAddRoom}
        className={`${pickerButtonClass} lg:col-span-2 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        + 部屋を追加({rooms.length}/{MAX_ROOMS})
      </button>
    </div>
  );
}
