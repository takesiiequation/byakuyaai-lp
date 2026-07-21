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

// 2026-07-17 魅力ゾーン: 「この物件の魅力」自由記入欄(任意)。GAS標準
// フォームの13フィールドには無い新規フィールド(=payload は14フィールド
// になる。n8n側の Parse Form Data が空文字fail-softで受ける前提)。
export const MAX_APPEAL_NOTE_LENGTH = 1000;

// 費用系ワードのソフトガード(app/revise/_components/ReviseForm.tsx の
// COST_WARNING_KEYWORDS と同じ運用・同じ語彙をここに複製)。ブロックは
// せず、送信前に一度だけ確認ダイアログを挟むだけ。将来語を増やす場合は
// 両ファイルに反映すること(意図的に共有importにしていない — revise側は
// 別フォームの別関心事のため、疎結合を優先)。
export const COST_WARNING_KEYWORDS: string[] = [
  "初期費用",
  "敷金礼金",
  "敷金・礼金",
  "敷金0",
  "礼金0",
  "敷金なし",
  "礼金なし",
  "敷金無料",
  "礼金無料",
  "仲介手数料無料",
  "仲介手数料0",
  "手数料無料",
  "フリーレント",
  "更新料無料",
  "0円",
];

export function containsCostWarningKeyword(text: string): boolean {
  return COST_WARNING_KEYWORDS.some((k) => text.includes(k));
}

export interface FileCheck {
  ok: boolean;
  error?: string;
}

// ============================================================
// 部屋カードUI(Phase A・2026-07-21・fudosan-video/docs/smapho_hitotsu_
// design.md §1/§2)。env `PORTAL_ROOMS_UI` が "true" のときだけ
// SubmitForm がこの下の型/定数を使う新UIに切り替わる。フラグ未設定/
// false は現行UI(物件写真フラット選択)を1行も変えず維持する。
// ============================================================

// 部屋名チップ。「その他」を選ぶと自由記入欄に切り替わる(§2「チップ+
// 自由記入」)。ラベルは任意 — 未選択は null のまま送る(Vision現行判定)。
export const ROOM_LABEL_CHIPS = [
  "リビング",
  "キッチン",
  "浴室",
  "洗面",
  "トイレ",
  "玄関",
  "廊下",
  "洋室",
  "和室",
  "バルコニー",
  "外観",
  "その他",
] as const;
export const ROOM_LABEL_OTHER = "その他";

export const MAX_ROOMS = 10; // 部屋カードの上限(写真上限MAX_PHOTOSと同水準)
export const MAX_ROOM_PHOTOS_PER_CARD = 2; // 1カードの写真は「始まり/終わり」の最大2枚
// 動画は1カード1本まで。全体上限は写真と別枠(1部屋1本クリップの想定本数は
// 少数のため、写真ほど大きくしない)。
export const MAX_VIDEOS = 10;

// 写真の長辺推奨値未満は警告のみ(fail-soft・送信は妨げない・§2)。
export const ROOM_PHOTO_MIN_LONG_SIDE = 1500;

// 動画の尺上限(§2「30秒超は拒否」)。1080p設定推奨はUI文言のみで技術的
// 検証はしない(解像度メタはブラウザ側で取りにくく、拒否根拠にはしない)。
export const MAX_VIDEO_DURATION_SEC = 30;

export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"];
const VIDEO_EXT_RE = /\.(mp4|mov)$/i;

// 写真/マイソクのMAX_..._BYTES(25MB)はimgbbの32MB上限に余裕を持たせた
// 値(このファイル冒頭コメント参照)で、imgbbを経由しない動画には出典が
// 適用されない。動画はDriveへ直接resumable PUTするため下流のサイズ制約が
// 現状存在しない — 実写クリップ(10秒推奨/30秒上限・1080p)の実測レンジ
// (スマホ撮影30秒1080pで概ね数十〜150MB程度)に余裕を持たせて300MBとする。
// Phase B/C でn8n側の動画パイプラインが確定したら数値を見直すこと。
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

export function checkVideoFile(name: string, mime: string, size: number): FileCheck {
  const extOk = VIDEO_EXT_RE.test(name);
  const mimeOk = VIDEO_MIME_TYPES.includes(mime);
  if (!extOk && !mimeOk) {
    return { ok: false, error: `${name}: 動画は MP4 / MOV のみアップロードできます` };
  }
  if (size > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      error: `${name}: ファイルサイズが大きすぎます(上限${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB)`,
    };
  }
  if (size <= 0) {
    return { ok: false, error: `${name}: 空のファイルです` };
  }
  return { ok: true };
}

// --- 入稿スキーマ(design.md §1 と同型・payload の `rooms` フィールド) ---

export type RoomFrameRole = "start" | "end";

export interface RoomPayloadPhotoItem {
  kind: "photo";
  drive_id: string;
  frame_role: RoomFrameRole;
}

export interface RoomPayloadVideoItem {
  kind: "video";
  drive_id: string;
  duration_sec: number;
}

export type RoomPayloadItem = RoomPayloadPhotoItem | RoomPayloadVideoItem;

export interface RoomPayload {
  order: number;
  label: string | null;
  items: RoomPayloadItem[];
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
