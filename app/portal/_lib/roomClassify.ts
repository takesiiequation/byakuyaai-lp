"use client";

// P3(部屋名Vision自動下書き・2026-07-22・fudosan-video/docs/smapho_hitotsu_
// design.md「UIテスト実測レポート」P3改修)。/api/portal/room-classify を
// 叩くための最小クライアントヘルパー — 画像の縮小(canvas)・fetch・
// 複数部屋の並列(上限3)消化キューをここに閉じ込める。
//
// 全経路fail-soft: どの段階で失敗しても null を返す/呼び出し元コール
// バックを呼ばないだけで、例外を上へ投げない・エラーをUIに出さない
// (SubmitForm.tsxのsetError系には一切触れない)。コンソールログのみ。

import { ROOM_LABEL_CHIPS, ROOM_LABEL_OTHER } from "@/app/_lib/portalSubmitShared";

const CLASSIFY_URL = "/api/portal/room-classify";
const RESIZE_MAX_LONG_SIDE = 256;
const RESIZE_QUALITY = 0.7;
const CLASSIFY_CONCURRENCY = 3;

// 「その他」は下書きとしての価値が無いため非採用(design.md要件)。
const APPLICABLE_LABELS = new Set<string>(
  ROOM_LABEL_CHIPS.filter((c) => c !== ROOM_LABEL_OTHER)
);

/** 画像を長辺256px程度にcanvasで縮小し、生base64(data:プレフィックス
 * 無し)のJPEGを返す。デコード/描画に失敗したらnull(fail-soft — 呼び出し
 * 側は分類自体をスキップする)。 */
function resizePhotoToBase64(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const scale = Math.min(1, RESIZE_MAX_LONG_SIDE / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL("image/jpeg", RESIZE_QUALITY);
        const commaIdx = dataUrl.indexOf(",");
        resolve(commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : null);
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** 1枚を分類してByakuyaAIの部屋名語彙(ROOM_LABEL_CHIPSの「その他」を
 * 除いたもの)のいずれかを返す。204(鍵未設定/失敗のfail-soft)・
 * 非2xx・「その他」・語彙外はすべて null(=適用しない)。例外は投げない。 */
export async function classifyRoomPhoto(file: File): Promise<string | null> {
  try {
    const base64 = await resizePhotoToBase64(file);
    if (!base64) return null;

    const res = await fetch(CLASSIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
    });
    if (res.status === 204 || !res.ok) return null;

    const data = (await res.json().catch(() => null)) as { label?: unknown } | null;
    const label = typeof data?.label === "string" ? data.label : null;
    if (!label || !APPLICABLE_LABELS.has(label)) return null;
    return label;
  } catch (e) {
    console.error("[roomClassify] classifyRoomPhoto failed (fail-soft):", e);
    return null;
  }
}

/** 複数部屋を最大3並列で消化しながら分類する(design.md「並列は最大3・
 * 逐次消化」)。各部屋の判定が届き次第 onLabel(uid, label) を呼ぶ —
 * onLabel側(SubmitForm.tsx)が「まだ適用してよい状態か」を呼ばれた
 * その場で再判定する責任を持つ(このヘルパーは判定タイミングにしか
 * 関与しない)。1件の失敗が他の部屋の分類を止めない(各タスクは
 * classifyRoomPhoto内で自己完結してfail-softに握り潰す)。 */
export async function classifyRoomsAsync(
  targets: Array<{ uid: string; file: File }>,
  onLabel: (uid: string, label: string) => void
): Promise<void> {
  if (targets.length === 0) return;
  let nextIndex = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= targets.length) return;
      const { uid, file } = targets[i];
      const label = await classifyRoomPhoto(file);
      if (label) onLabel(uid, label);
    }
  }
  const workerCount = Math.min(CLASSIFY_CONCURRENCY, targets.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
