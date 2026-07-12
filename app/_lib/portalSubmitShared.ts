// /portal/submit の共有定数+純粋バリデーション(クライアント/サーバー両用)。
// ここには googleapis / crypto 等のサーバー専用 import を置かないこと —
// SubmitForm.tsx(client component)が直接 import する。
//
// 制約の出典はすべて「ポータル送信API 仕様書(突合確定版)」:
//  - 写真は最大10枚(n8n側でも先頭10にcapされる)
//  - 写真の列挙条件は mimeType contains 'image/' → HEICも拾われてしまい
//    下流(imgbb/Gemini)互換リスクがあるため、ポータルでは HEIC/HEIF を
//    受け付けない(ブラウザにはHEICデコーダが無く canvas 変換も不可能な
//    ため「変換」ではなく「拒否+案内」で invariant を守る)
//  - マイソクは n8n が imgbb へ multipart 直送するため画像推奨。ただし
//    現行GAS標準フォームは PDF 可なので互換のため PDF も受ける(既知の
//    潜在リスクとして仕様書(3)に記載済み・新規リスクではない)

export const MAX_PHOTOS = 10;
export const MIN_PHOTOS = 1; // n8nは写真0枚だと「写真が見つかりません」throw=即死
export const RECOMMENDED_PHOTOS = "5〜10枚";

// imgbbの上限32MBに対して余裕を持たせる
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
export const MAX_MAISOKU_BYTES = 25 * 1024 * 1024;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAISOKU_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

// ブラウザによってはHEICの type が空文字になるため拡張子でも防ぐ
const BANNED_EXT_RE = /\.(heic|heif)$/i;

export const ASPECT_RATIOS = ["9:16", "1:1"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const DEAL_TYPES = ["rental", "sale"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export interface FileCheck {
  ok: boolean;
  error?: string;
}

export function checkPhotoFile(name: string, mime: string, size: number): FileCheck {
  if (BANNED_EXT_RE.test(name) || mime === "image/heic" || mime === "image/heif") {
    return {
      ok: false,
      error: `${name}: HEIC形式は使用できません。iPhoneの場合は「設定→カメラ→フォーマット→互換性優先」で撮影するか、JPEGに変換してください`,
    };
  }
  if (!PHOTO_MIME_TYPES.includes(mime)) {
    return { ok: false, error: `${name}: JPEG / PNG / WebP の画像のみアップロードできます` };
  }
  if (size > MAX_PHOTO_BYTES) {
    return { ok: false, error: `${name}: ファイルサイズが大きすぎます(上限25MB)` };
  }
  if (size <= 0) {
    return { ok: false, error: `${name}: 空のファイルです` };
  }
  return { ok: true };
}

export function checkMaisokuFile(name: string, mime: string, size: number): FileCheck {
  if (BANNED_EXT_RE.test(name) || mime === "image/heic" || mime === "image/heif") {
    return { ok: false, error: `${name}: HEIC形式は使用できません。PDFまたはJPEG/PNGでアップロードしてください` };
  }
  if (!MAISOKU_MIME_TYPES.includes(mime)) {
    return { ok: false, error: `${name}: PDF / JPEG / PNG のみアップロードできます` };
  }
  if (size > MAX_MAISOKU_BYTES) {
    return { ok: false, error: `${name}: ファイルサイズが大きすぎます(上限25MB)` };
  }
  if (size <= 0) {
    return { ok: false, error: `${name}: 空のファイルです` };
  }
  return { ok: true };
}
