"use client";

// 部屋カード写真タイルの Pointer Events ベース DnD(v3.1段2・2026-07-21)。
// smapho_hitotsu_design.md「UI v3.1改修+誤ペア三重ガード」の続き — 段1の
// PairMismatchWarning(=誤ペアを「検知」)に続き、ここでは誤ペア/誤部屋を
// 「直感的に直せる」操作を足す。既存の HTML5 native drag
// (draggable/onDragStart/onDragOver/onDrop)はタッチでは発火しないため、
// 段1以前の実装(RoomCardsField.tsx)を丸ごとこちらへ置き換える —
// 旧方式と新方式を並走させると二重発火の危険があるため、置換のみで共存
// させない。
//
// 状態機械:
//   IDLE --pointerdown--> PENDING
//     マウス: 閾値(8px)移動で即DRAGGING(タイマーなし=time0発火)
//     タッチ/ペン: 300ms長押しタイマーを仕込む。タイマー完了前に8pxを
//       超える移動、または pointerup/pointercancel が来たらキャンセルして
//       IDLEへ(=タップやページスクロールとしてブラウザへ素通しする。
//       ここでは一切 preventDefault しないので通常のスクロール/クリックは
//       阻害されない)
//   PENDING --発火条件成立--> DRAGGING
//     ゴースト要素(fixed・pointer-events:none・元タイルのクローン)を
//     生成してポインタに追従させる。touch-action:none はこの瞬間に初めて
//     適用する(長押し発火後のみ=要件どおり通常スクロールは阻害しない)。
//     setPointerCapture でこのポインタを掴む(ベストエフォート・失敗しても
//     window監視で機能は継続=fail-soft)。
//   DRAGGING --pointermove(rAFで1frameに1回へスロットル)-->
//     ゴースト位置を直接DOM操作で更新(Reactの再レンダーを経由しない=
//     60fps維持)。同時に elementFromPoint でドロップ先を再判定し、
//     変化したときだけ React state(dropTarget)を更新してハイライトへ
//     反映する。
//   DRAGGING --pointerup--> その時点のドロップ先が有効なら onSwap/onMove
//     を呼んでから後始末。無効なら後始末のみ(何もしない)。
//   PENDING/DRAGGING --pointercancel--> 何もせず後始末のみ。
//
// ドロップ判定(resolveDropTarget): elementFromPoint で得た要素から
// closest("[data-drop-photo]") が見つかれば「swap」候補(自分自身は除外)。
// 無ければ closest("[data-drop-room]") を見て「move」候補(呼び出し元の
// isValidMoveTarget で許可された部屋だけをハイライト=要件2「有効な受け先
// だけ」)。ゴースト自身は pointer-events:none のため elementFromPoint には
// 写らない(ブラウザ仕様)。
//
// このフックはドメイン知識(部屋の容量/写真動画排他等)を一切持たない —
// isValidMoveTarget を通じて呼び出し側(RoomCardsField)がその判定を注入する。
// swap は「写真タイル同士」という前提(呼び出し側が data-drop-photo を
// photoアイテムにしか付けない)で常に安全(件数を変えない入替のため容量/
// 排他のinvariantは自動的に保たれる)なので、専用のバリデータを持たない。

import { useCallback, useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface RoomItemRef {
  uid: string;
  itemIdx: number;
}

export interface DropTarget {
  kind: "swap" | "move";
  uid: string;
  itemIdx?: number; // kind === "swap" のときのみ意味を持つ
}

const LONG_PRESS_MS = 300;
const MOVE_THRESHOLD_PX = 8;

export interface UseRoomItemDragOptions {
  /** 写真タイル同士の入替。同室内(start/end入替)・別室間のどちらも同じ
   * 意味論で呼ばれる。 */
  onSwap: (from: RoomItemRef, to: RoomItemRef) => void;
  /** 別の部屋カードへの移動。既存の moveRoomItemToRoom 等をそのまま渡す
   * 想定(容量/写真動画排他の検証とエラー表示は呼び出し先が担う)。 */
  onMove: (from: RoomItemRef, toUid: string) => void;
  /** 部屋本体へのドロップをハイライト/許可してよいかの判定。 */
  isValidMoveTarget: (from: RoomItemRef, toUid: string) => boolean;
  /** true の間はポインタダウンを一切拾わない(busy中/フラグOFF時など)。 */
  disabled?: boolean;
}

export interface UseRoomItemDragResult {
  /** 現在ドラッグ中の元アイテム(ハイライト/ダミング判定用の低頻度state)。 */
  activeItem: RoomItemRef | null;
  /** 現在の有効なドロップ先候補(低頻度state)。 */
  dropTarget: DropTarget | null;
  /** 写真タイルの「掴む」要素へ spread する props。 */
  getHandleProps: (item: RoomItemRef) => {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  };
}

interface DragState {
  phase: "idle" | "pending" | "dragging";
  item: RoomItemRef | null;
  pointerId: number | null;
  pointerType: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  handleEl: HTMLElement | null;
  ghostEl: HTMLElement | null;
  rafId: number | null;
  dropTarget: DropTarget | null;
}

function freshState(): DragState {
  return {
    phase: "idle",
    item: null,
    pointerId: null,
    pointerType: "mouse",
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    longPressTimer: null,
    handleEl: null,
    ghostEl: null,
    rafId: null,
    dropTarget: null,
  };
}

interface CallbacksRef {
  onSwap: (from: RoomItemRef, to: RoomItemRef) => void;
  onMove: (from: RoomItemRef, toUid: string) => void;
  isValidMoveTarget: (from: RoomItemRef, toUid: string) => boolean;
}

/** ドラッグの状態機械+DOM操作を1インスタンス分だけ抱える純粋なコント
 * ローラー。React state のセッターだけを外から受け取り、それ以外は
 * すべて内部の可変クロージャ変数(callbacks/disabled)で完結する(60fps
 * 更新をReact再レンダーの外で行うための設計 — 上のファイル冒頭コメント
 * 参照)。React ref は使わない — 最新の react-hooks/refs lint ルールが
 * 「render中のref読み書き」を(公式ドキュメントのlazy-init慣用句すら)
 * 一律で禁止するため、callbacks/disabledはこのクロージャが持つ普通の
 * 変数とし、呼び出し側(下のuseRoomItemDrag)がuseEffect(=render外)から
 * setCallbacks/setDisabledを呼んで同期する。コンポーネントの寿命中
 * 1回だけ生成し(呼び出し側で useState の遅延初期化により固定)、以後は
 * 使い回す。 */
function createController(
  setActiveItem: (v: RoomItemRef | null) => void,
  setDropTarget: (v: DropTarget | null) => void
) {
  const s = freshState();
  let callbacks: CallbacksRef = {
    onSwap: () => {},
    onMove: () => {},
    isValidMoveTarget: () => false,
  };
  let disabled = false;

  function resolveDropTarget(clientX: number, clientY: number): DropTarget | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;

    const photoEl = el.closest("[data-drop-photo]");
    if (photoEl) {
      const raw = photoEl.getAttribute("data-drop-photo") || "";
      const sep = raw.indexOf(":");
      if (sep > 0) {
        const uid = raw.slice(0, sep);
        const idx = Number(raw.slice(sep + 1));
        if (uid && Number.isFinite(idx)) {
          if (s.item && s.item.uid === uid && s.item.itemIdx === idx) return null; // 自分自身
          return { kind: "swap", uid, itemIdx: idx };
        }
      }
    }

    const roomEl = el.closest("[data-drop-room]");
    if (roomEl) {
      const uid = roomEl.getAttribute("data-drop-room") || "";
      if (uid && s.item && uid !== s.item.uid && callbacks.isValidMoveTarget(s.item, uid)) {
        return { kind: "move", uid };
      }
    }
    return null;
  }

  function applyHighlight(next: DropTarget | null) {
    const cur = s.dropTarget;
    const same =
      (cur === null && next === null) ||
      (!!cur && !!next && cur.kind === next.kind && cur.uid === next.uid && cur.itemIdx === next.itemIdx);
    if (same) return;
    s.dropTarget = next;
    setDropTarget(next);
  }

  function updateGhostPosition(x: number, y: number) {
    const ghost = s.ghostEl;
    if (!ghost) return;
    const offsetX = Number(ghost.dataset.offsetX || "0");
    const offsetY = Number(ghost.dataset.offsetY || "0");
    ghost.style.transform = `translate3d(${x - offsetX}px, ${y - offsetY}px, 0)`;
  }

  function scheduleFrame() {
    if (s.rafId !== null) return;
    s.rafId = requestAnimationFrame(() => {
      s.rafId = null;
      updateGhostPosition(s.lastX, s.lastY);
      applyHighlight(resolveDropTarget(s.lastX, s.lastY));
    });
  }

  function startDragging() {
    if (!s.handleEl || !s.item) return;
    s.phase = "dragging";

    const rect = s.handleEl.getBoundingClientRect();
    const ghost = s.handleEl.cloneNode(true) as HTMLElement;
    // ゴーストは見た目だけのコピー — 内部のボタン/セレクトは操作不能な
    // ままだと紛らわしいので取り除く(pointer-events:noneで元々操作は
    // 不能だが、見た目のノイズを減らすため)。
    ghost.querySelectorAll("button, select, input").forEach((n) => n.remove());
    ghost.removeAttribute("data-drop-photo");
    ghost.removeAttribute("data-drop-room");
    ghost.style.position = "fixed";
    ghost.style.left = "0";
    ghost.style.top = "0";
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.margin = "0";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    ghost.style.opacity = "0.92";
    ghost.style.boxShadow = "0 10px 28px rgba(0,0,0,0.28)";
    ghost.style.borderRadius = "0.75rem";
    ghost.style.willChange = "transform";
    ghost.style.transition = "none";
    ghost.dataset.offsetX = String(s.lastX - rect.left);
    ghost.dataset.offsetY = String(s.lastY - rect.top);
    ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    document.body.appendChild(ghost);
    s.ghostEl = ghost;

    // 長押し/移動閾値の発火後にのみ適用(通常のスクロール/タップは
    // このコードに到達しないため一切阻害されない)。
    s.handleEl.style.touchAction = "none";
    document.body.style.userSelect = "none";

    if (s.pointerId !== null) {
      try {
        s.handleEl.setPointerCapture(s.pointerId);
      } catch {
        // 一部要素/ブラウザでは失敗しうる。window監視で機能は継続する
        // ためfail-soft。
      }
    }

    setActiveItem(s.item);
  }

  function teardown() {
    if (s.longPressTimer) {
      clearTimeout(s.longPressTimer);
      s.longPressTimer = null;
    }
    if (s.rafId !== null) {
      cancelAnimationFrame(s.rafId);
      s.rafId = null;
    }
    if (s.ghostEl) {
      s.ghostEl.remove();
      s.ghostEl = null;
    }
    if (s.handleEl) {
      s.handleEl.style.touchAction = "";
      if (s.pointerId !== null) {
        try {
          s.handleEl.releasePointerCapture(s.pointerId);
        } catch {
          // 未捕捉/解放済みは無視
        }
      }
    }
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", onPointerMoveWindow);
    window.removeEventListener("pointerup", onPointerUpWindow);
    window.removeEventListener("pointercancel", onPointerCancelWindow);

    s.phase = "idle";
    s.item = null;
    s.pointerId = null;
    s.handleEl = null;
    s.dropTarget = null;
    setActiveItem(null);
    setDropTarget(null);
  }

  function onPointerMoveWindow(e: PointerEvent) {
    if (s.pointerId !== e.pointerId) return;

    if (s.phase === "pending") {
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (Math.hypot(dx, dy) <= MOVE_THRESHOLD_PX) return;
      if (s.pointerType === "touch" || s.pointerType === "pen") {
        // 長押し確定前の大きな移動 = スクロール意図。preventDefaultして
        // いないのでブラウザのネイティブスクロールはそのまま続く。
        teardown();
        return;
      }
      // マウス: 閾値到達で即ドラッグ開始(time0発火・タイマー不要)
      if (s.longPressTimer) {
        clearTimeout(s.longPressTimer);
        s.longPressTimer = null;
      }
      startDragging();
      return;
    }

    if (s.phase !== "dragging") return;
    // ドラッグ確定後のみページスクロール等を抑止する。
    e.preventDefault();
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    scheduleFrame();
  }

  function onPointerUpWindow(e: PointerEvent) {
    if (s.pointerId !== e.pointerId) return;

    if (s.phase === "dragging") {
      const item = s.item;
      const finalTarget = resolveDropTarget(e.clientX, e.clientY);
      teardown();
      if (item && finalTarget) {
        if (finalTarget.kind === "swap" && typeof finalTarget.itemIdx === "number") {
          callbacks.onSwap(item, { uid: finalTarget.uid, itemIdx: finalTarget.itemIdx });
        } else if (finalTarget.kind === "move") {
          callbacks.onMove(item, finalTarget.uid);
        }
      }
      return;
    }
    // PENDING中のpointerup = ドラッグは発生しなかった(タップ)。ここでも
    // preventDefaultしていないため、削除ボタン等の通常のclickイベントは
    // ブラウザが今までどおり発火させる。
    teardown();
  }

  function onPointerCancelWindow(e: PointerEvent) {
    if (s.pointerId !== e.pointerId) return;
    teardown();
  }

  function onPointerDown(item: RoomItemRef, e: ReactPointerEvent<HTMLElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return; // 左クリックのみ
    if (s.phase !== "idle") return; // 既存ドラッグ中の多重pointerdownは無視

    s.phase = "pending";
    s.item = item;
    s.pointerId = e.pointerId;
    s.pointerType = e.pointerType;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.handleEl = e.currentTarget;

    window.addEventListener("pointermove", onPointerMoveWindow);
    window.addEventListener("pointerup", onPointerUpWindow);
    window.addEventListener("pointercancel", onPointerCancelWindow);

    if (e.pointerType === "touch" || e.pointerType === "pen") {
      s.longPressTimer = setTimeout(() => {
        s.longPressTimer = null;
        if (s.phase === "pending") startDragging();
      }, LONG_PRESS_MS);
    }
    // マウス(その他のpointerType含む): タイマーなし。onPointerMoveWindowの
    // 閾値判定がそのままdragging開始トリガーになる(=time0発火)。
  }

  function setCallbacks(next: CallbacksRef) {
    callbacks = next;
  }

  function setDisabled(next: boolean) {
    disabled = next;
  }

  return { onPointerDown, teardown, setCallbacks, setDisabled };
}

export function useRoomItemDrag({
  onSwap,
  onMove,
  isValidMoveTarget,
  disabled = false,
}: UseRoomItemDragOptions): UseRoomItemDragResult {
  const [activeItem, setActiveItem] = useState<RoomItemRef | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // useStateの遅延初期化=コンポーネントの寿命中1回だけ生成される(React
  // が保証)。setActiveItem/setDropTargetはReactのstateセッターで恒等性が
  // 安定しているため、依存に含めなくても安全(exhaustive-depsも許容する
  // 既知パターン)。
  const [controller] = useState(() => createController(setActiveItem, setDropTarget));

  // 最新のコールバック/disabledをrender外(useEffect)でコントローラーへ
  // 同期する。callbacksは依存配列なし(=毎レンダー後に同期・単純な
  // オブジェクト代入なのでコスト無視できる)。disabledは値のときだけ。
  useEffect(() => {
    controller.setCallbacks({ onSwap, onMove, isValidMoveTarget });
  });
  useEffect(() => {
    controller.setDisabled(disabled);
  }, [controller, disabled]);
  useEffect(() => {
    return () => controller.teardown();
  }, [controller]);

  const getHandleProps = useCallback(
    (item: RoomItemRef) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        controller.onPointerDown(item, e);
      },
    }),
    [controller]
  );

  return { activeItem, dropTarget, getHandleProps };
}
