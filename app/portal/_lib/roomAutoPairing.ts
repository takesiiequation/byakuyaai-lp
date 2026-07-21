// クライアント側決定論ペアリング(LLM不要・無料・高速・サーバー往復なし)。
// fudosan-video/docs/smapho_hitotsu_design.md
// 「自動ペアリング確認UI実装spec」+「入口UIの再設計」の実装。
//
// 一括選択された写真群を、知覚ハッシュ(dHash・Canvasで自前計算=外部
// ライブラリ追加なし)と EXIF撮影時刻の近接で同一部屋候補にグルーピング
// し、各グループ内で最も似た2枚を start/end ペアと推定する(撮影時刻が
// 早い方を start)。3枚以上/単独は1枚モード(design.md 決定事項どおり)。
// 部屋名は「ファイル名ヒント」の簡易ヒューリスティックで下書きを付ける。
//
// この推定は常に「下書き」— 精度が完璧である必要はない。確認画面で顧客が
// 必ず直せることが人的最終ガード(design.md「自動ペアリング確認UI実装
// spec」)。ここは純粋関数+ブラウザAPI(Image/Canvas/DataView)のみで、
// サーバーやLLMには一切依存しない。

import { ROOM_LABEL_CHIPS, VIDEO_MIME_TYPES } from "@/app/_lib/portalSubmitShared";

const VIDEO_EXT_RE = /\.(mp4|mov)$/i;

/** 自動推定できなかった場合の暫定ラベル。ROOM_LABEL_CHIPSに存在しない
 * 文字列なので、確認画面では自由記入欄として「お部屋」が編集可能な状態
 * で表示される(要件3: 自動推定は下書きであって強制でない)。 */
export const TENTATIVE_ROOM_LABEL = "お部屋";

const KNOWN_LABELS = new Set<string>(
  ROOM_LABEL_CHIPS.filter((c) => c !== "その他")
);

function isKnownLabel(label: string): boolean {
  return KNOWN_LABELS.has(label);
}

export type AutoGroupedRoomKind = "photo" | "video";

export interface AutoGroupedRoom {
  label: string | null;
  customLabelMode: boolean;
  kind: AutoGroupedRoomKind;
  files: File[]; // photo: 1〜2枚(順序=start→end)。video: 1本
}

function isVideoFile(file: File): boolean {
  return VIDEO_MIME_TYPES.includes(file.type) || VIDEO_EXT_RE.test(file.name);
}

// --- 部屋名の下書き(ファイル名ヒント。無理なら暫定ラベル) ---

const LABEL_HINTS: Array<{ re: RegExp; label: string }> = [
  { re: /(リビング|living|ldk)/i, label: "リビング" },
  { re: /(キッチン|kitchen)/i, label: "キッチン" },
  { re: /(浴室|バス(?!ケット)|bath)/i, label: "浴室" },
  { re: /(洗面|wash)/i, label: "洗面" },
  { re: /(トイレ|toilet|^wc|[^a-z]wc)/i, label: "トイレ" },
  { re: /(玄関|entrance|genkan)/i, label: "玄関" },
  { re: /(廊下|hall|corridor)/i, label: "廊下" },
  { re: /(和室|tatami)/i, label: "和室" },
  { re: /(洋室|bedroom|洋間)/i, label: "洋室" },
  { re: /(バルコニー|ベランダ|balcony|veranda)/i, label: "バルコニー" },
  { re: /(外観|エクステリア|exterior|gaikan)/i, label: "外観" },
];

function guessLabelFromFilename(name: string): string | null {
  for (const { re, label } of LABEL_HINTS) {
    if (re.test(name)) return label;
  }
  return null;
}

// --- 知覚ハッシュ(dHash・8x8=64bit) ---

function loadImageElement(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

interface DHashResult {
  bits: Uint8Array; // 64要素・各0/1
  brightness: number; // 0-255目安(将来のヒューリスティック用に保持)
}

/** 画像を9x8へ縮小してからハッシュ計算するため、原寸の大小に関わらず
 * 計算コストは一定(design.md注意事項「画像を小さくリサイズしてから」)。
 * UIをブロックしないよう呼び出し側は複数ファイルを順に await する
 * (各ファイルのデコードでイベントループに自然に処理が返る)。 */
async function computeDHash(file: File): Promise<DHashResult | null> {
  const img = await loadImageElement(file);
  if (!img) return null;
  const w = 9;
  const h = 8;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }
    const bits = new Uint8Array(64);
    let bi = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w - 1; x++) {
        bits[bi++] = gray[y * w + x] < gray[y * w + x + 1] ? 1 : 0;
      }
    }
    let sum = 0;
    for (let i = 0; i < gray.length; i++) sum += gray[i];
    return { bits, brightness: sum / gray.length };
  } catch {
    // canvasが読めない(セキュリティ制約等)場合はfail-soft — ハッシュ無しの
    // 扱いになり、下流は撮影時刻や選択順にフォールバックする。
    return null;
  }
}

function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// --- EXIF撮影時刻(JPEGのみ・最小実装・fail-soft) ---

function readAsciiString(view: DataView, offset: number, maxLen: number): string {
  let out = "";
  for (let i = 0; i < maxLen; i++) {
    if (offset + i >= view.byteLength) break;
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

function findDateInIFD(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean,
  depth: number
): string | null {
  if (depth > 2 || ifdOffset <= 0 || ifdOffset + 2 > view.byteLength) return null;
  const numEntries = view.getUint16(ifdOffset, little);
  let subIFDOffset = 0;
  let dateStr: string | null = null;
  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, little);
    const type = view.getUint16(entryOffset + 2, little);
    const count = view.getUint32(entryOffset + 4, little);
    if (tag === 0x8769) {
      subIFDOffset = view.getUint32(entryOffset + 8, little);
    }
    if ((tag === 0x9003 || tag === 0x0132) && type === 2) {
      const valueOffset =
        count <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, little);
      const s = readAsciiString(view, valueOffset, Math.min(count, 20));
      if (tag === 0x9003) return s; // DateTimeOriginal優先・見つかり次第確定
      dateStr = dateStr ?? s;
    }
  }
  if (subIFDOffset > 0) {
    const sub = findDateInIFD(view, tiffStart, tiffStart + subIFDOffset, little, depth + 1);
    if (sub) return sub;
  }
  return dateStr;
}

/** JPEG の EXIF から撮影日時(epoch ms)を読む。読めない/対象外の形式は
 * null(fail-soft — ペアリングはハッシュのみ or 選択順にフォールバック)。 */
async function readExifDateTaken(file: File): Promise<number | null> {
  if (file.type !== "image/jpeg" && !/\.jpe?g$/i.test(file.name)) return null;
  try {
    // EXIFはファイル先頭付近(通常64KB以内)にある。先頭256KBだけ読めば十分。
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      if (marker === 0xffe1) {
        const exifStart = offset + 4;
        if (exifStart + 6 > view.byteLength) return null;
        if (view.getUint32(exifStart) !== 0x45786966 /* "Exif" */) return null;
        const tiffStart = exifStart + 6;
        const little = view.getUint16(tiffStart) === 0x4949;
        const firstIFDOffset = view.getUint32(tiffStart + 4, little);
        const dateStr = findDateInIFD(view, tiffStart, tiffStart + firstIFDOffset, little, 0);
        if (!dateStr) return null;
        const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(dateStr);
        if (!m) return null;
        const [, y, mo, d, h, mi, s] = m;
        return new Date(
          Number(y),
          Number(mo) - 1,
          Number(d),
          Number(h),
          Number(mi),
          Number(s)
        ).getTime();
      }
      if (marker === 0xffda) break; // Start of Scan以降にEXIFは無い
      const size = view.getUint16(offset + 2);
      offset += 2 + size;
    }
    return null;
  } catch {
    return null;
  }
}

// --- グルーピング本体 ---

interface PhotoHashInfo {
  file: File;
  index: number; // 元の選択順(グループの並び順の最終フォールバック)
  dHash: Uint8Array | null;
  capturedAt: number | null;
  guessedLabel: string | null;
}

// 64bit中の許容ハミング距離。ハッシュだけで同室と見なす閾値(厳しめ)と、
// 撮影時刻が近い(90秒以内)場合に緩める閾値の2段構え — design.md追補v2の
// 「対角撮影は中間発明」の教訓どおり、同室でも見た目の差が出うるため。
const SIMILAR_HASH_THRESHOLD = 14;
const LOOSE_HASH_THRESHOLD = 22;
const TIME_WINDOW_MS = 90 * 1000;

function singlePhotoGroup(info: PhotoHashInfo): AutoGroupedRoom & { anchorIndex: number } {
  const label = info.guessedLabel ?? TENTATIVE_ROOM_LABEL;
  return {
    label,
    customLabelMode: !isKnownLabel(label),
    kind: "photo",
    files: [info.file],
    anchorIndex: info.index,
  };
}

function clusterPhotoInfos(infos: PhotoHashInfo[]): Array<AutoGroupedRoom & { anchorIndex: number }> {
  const n = infos.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = infos[i];
      const b = infos[j];
      if (!a.dHash || !b.dHash) continue;
      const dist = hammingDistance(a.dHash, b.dHash);
      const timeDiff =
        a.capturedAt !== null && b.capturedAt !== null ? Math.abs(a.capturedAt - b.capturedAt) : null;
      const closeInTime = timeDiff !== null && timeDiff <= TIME_WINDOW_MS;
      if (dist <= SIMILAR_HASH_THRESHOLD || (closeInTime && dist <= LOOSE_HASH_THRESHOLD)) {
        union(i, j);
      }
    }
  }

  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = clusterMap.get(root);
    if (list) list.push(i);
    else clusterMap.set(root, [i]);
  }

  const result: Array<AutoGroupedRoom & { anchorIndex: number }> = [];
  for (const members of clusterMap.values()) {
    if (members.length >= 3) {
      // 3枚以上は誤爆リスクが高いため1枚モードへ分解(design.md決定事項)
      const sorted = [...members].sort((x, y) => infos[x].index - infos[y].index);
      for (const m of sorted) result.push(singlePhotoGroup(infos[m]));
      continue;
    }
    if (members.length === 2) {
      const [ia, ib] = members;
      const a = infos[ia];
      const b = infos[ib];
      let ordered: [PhotoHashInfo, PhotoHashInfo];
      if (a.capturedAt !== null && b.capturedAt !== null && a.capturedAt !== b.capturedAt) {
        ordered = a.capturedAt < b.capturedAt ? [a, b] : [b, a];
      } else {
        ordered = a.index <= b.index ? [a, b] : [b, a];
      }
      const label = ordered[0].guessedLabel ?? ordered[1].guessedLabel ?? TENTATIVE_ROOM_LABEL;
      result.push({
        label,
        customLabelMode: !isKnownLabel(label),
        kind: "photo",
        files: ordered.map((o) => o.file),
        anchorIndex: Math.min(a.index, b.index),
      });
      continue;
    }
    result.push(singlePhotoGroup(infos[members[0]]));
  }
  return result;
}

// --- 時系列連続ペアリング(入稿UI仕様v3・2026-07-21岡本裁定) ---
// dHashクラスタリングは実写内装で閾値が効かず(design.md追補v2 P2実測)、
// 「2枚1組は当たり前」の入稿契約に転換したことで前提そのものが変わった
// — 顧客は部屋ごとに連続して2枚撮るはずなので、EXIF撮影時刻(→無ければ
// lastModified→無ければ選択順)で並べて前から2枚ずつ組むのが最も精度が
// 高い。dHash関連コード(上のcomputeDHash/clusterPhotoInfos等)は削除せず
// 残す(将来の妥当性警告=「この2枚は本当に近いか」の補助チェック用)。

interface TimeOrderedPhoto {
  file: File;
  index: number; // 選択順(EXIF/lastModifiedとも無い場合の最終フォールバック)
  sortKey: number;
  guessedLabel: string | null;
}

/** 写真ファイル群を「同じ部屋を2枚1組(始まり→終わり)」の既定則で
 * 部屋グループへ変換する。並び順は EXIF DateTimeOriginal → file.lastModified
 * → 選択順、の優先度で昇順ソートしたのち前から2枚ずつ組む。奇数の余りは
 * 1枚部屋になる(confirm画面で「+2枚目を追加」できる=呼び出し側の
 * RoomCardsFieldが対応)。動画は扱わない(呼び出し側でタブ分離済み)。 */
export async function pairPhotosByCaptureTime(files: File[]): Promise<AutoGroupedRoom[]> {
  const infos: TimeOrderedPhoto[] = await Promise.all(
    files.map(async (file, index) => {
      const capturedAt = await readExifDateTaken(file);
      const lastModified =
        Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : null;
      const sortKey = capturedAt ?? lastModified ?? index;
      return { file, index, sortKey, guessedLabel: guessLabelFromFilename(file.name) };
    })
  );

  // sortKeyが同値(lastModified無しで選択順にフォールバックした場合等)の
  // ときは選択順(index)で安定させる。
  const sorted = [...infos].sort((a, b) => a.sortKey - b.sortKey || a.index - b.index);

  const rooms: AutoGroupedRoom[] = [];
  for (let i = 0; i < sorted.length; i += 2) {
    const first = sorted[i];
    const second = sorted[i + 1];
    if (second) {
      const label = first.guessedLabel ?? second.guessedLabel ?? TENTATIVE_ROOM_LABEL;
      rooms.push({
        label,
        customLabelMode: !isKnownLabel(label),
        kind: "photo",
        files: [first.file, second.file],
      });
    } else {
      const label = first.guessedLabel ?? TENTATIVE_ROOM_LABEL;
      rooms.push({ label, customLabelMode: !isKnownLabel(label), kind: "photo", files: [first.file] });
    }
  }
  return rooms;
}

/** 動画ファイル群を「1本=1部屋」に変換する(design.md「動画は単独で
 * 1部屋」)。入稿UI仕様v3では動画タブが写真タブと分離されたため、混在
 * 判定(isVideoFile)は不要— 呼び出し側が動画のみを渡す前提。 */
export function groupVideosIndividually(files: File[]): AutoGroupedRoom[] {
  return files.map((file) => {
    const label = guessLabelFromFilename(file.name) ?? TENTATIVE_ROOM_LABEL;
    return { label, customLabelMode: !isKnownLabel(label), kind: "video", files: [file] };
  });
}

// --- ペア妥当性警告(v3.1改修B・入稿UI仕様v3.1・smapho_hitotsu_design.md
// 「UI v3.1改修+誤ペア三重ガード」段1)。dHashクラスタリングは部屋自動
// 仕分けの主経路からは降格したが(上記コメント参照)、「この2枚は本当に
// 同じ部屋か」という第2ガードとしてここで再登用する。実測(design.md
// 該当節): 同室ペアの距離=24 / 別部屋ペアの距離=31。誤警告(過検知)の
// 方が見逃しより顧客体験を損なう非ブロッキング警告のため、やや同室側に
// 寄せた28を閾値に採用する。 ---

export const PAIR_MISMATCH_THRESHOLD = 28;

/** ペア2枚(始まり/終わり)のdHashハミング距離を計算する。どちらかの
 * デコードに失敗したら null を返す(fail-open — 呼び出し側は警告を
 * 出さない)。既存の computeDHash / hammingDistance をそのまま再利用
 * (シグネチャ変更なし)。 */
export async function computePairMismatchDistance(
  fileA: File,
  fileB: File
): Promise<number | null> {
  const [a, b] = await Promise.all([computeDHash(fileA), computeDHash(fileB)]);
  if (!a || !b) return null;
  return hammingDistance(a.bits, b.bits);
}

/** 一括選択されたファイル群(写真+動画混在可)を、部屋ごとのグループへ
 * 分ける。写真はハッシュ+EXIF近接でグルーピング、動画は常に単独1部屋
 * (design.md「動画は単独で1部屋」)。戻り値は元の選択順を尊重した並び。
 * サーバー往復なし・純クライアント処理。
 * ⚠️入稿UI仕様v3(2026-07-21)以降、SubmitFormからは呼ばれていない
 * (写真/動画タブ分離+時系列ペアリングに置き換え済み=pairPhotosByCaptureTime/
 * groupVideosIndividually)。dHashクラスタリングの資産として残す
 * (将来の妥当性警告用途)。 */
export async function autoGroupBulkFiles(files: File[]): Promise<AutoGroupedRoom[]> {
  const photoEntries: { file: File; index: number }[] = [];
  const videoEntries: { file: File; index: number }[] = [];
  files.forEach((file, index) => {
    if (isVideoFile(file)) videoEntries.push({ file, index });
    else photoEntries.push({ file, index });
  });

  const photoInfos: PhotoHashInfo[] = await Promise.all(
    photoEntries.map(async ({ file, index }) => {
      const hashResult = await computeDHash(file);
      const capturedAt = await readExifDateTaken(file);
      return {
        file,
        index,
        dHash: hashResult?.bits ?? null,
        capturedAt,
        guessedLabel: guessLabelFromFilename(file.name),
      };
    })
  );

  const photoGroups = clusterPhotoInfos(photoInfos);
  const videoGroups: Array<AutoGroupedRoom & { anchorIndex: number }> = videoEntries.map(
    ({ file, index }) => {
      const label = guessLabelFromFilename(file.name) ?? TENTATIVE_ROOM_LABEL;
      return {
        label,
        customLabelMode: !isKnownLabel(label),
        kind: "video",
        files: [file],
        anchorIndex: index,
      };
    }
  );

  return [...photoGroups, ...videoGroups]
    .sort((a, b) => a.anchorIndex - b.anchorIndex)
    .map((g): AutoGroupedRoom => ({
      label: g.label,
      customLabelMode: g.customLabelMode,
      kind: g.kind,
      files: g.files,
    }));
}
