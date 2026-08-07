"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ASPECT_RATIOS,
  DEAL_TYPES,
  MAX_APPEAL_NOTE_LENGTH,
  MAX_TOTAL_PHOTOS,
  MAX_ROOMS,
  MAX_ROOM_PHOTOS_PER_CARD,
  MAX_VIDEO_DURATION_SEC,
  MAX_VIDEOS,
  ROOM_LABEL_OTHER,
  ROOM_PHOTO_MIN_LONG_SIDE,
  RECOMMENDED_PHOTOS,
  checkMaisokuFile,
  checkPhotoFile,
  checkVideoFile,
  containsCostWarningKeyword,
  type AspectRatio,
  type DealType,
  type RoomFrameRole,
  type RoomPayload,
} from "@/app/_lib/portalSubmitShared";
import RoomCardsField, {
  type RoomCardState,
  type RoomLocalItem,
} from "./RoomCardsField";
import BulkRoomIntake from "./BulkRoomIntake";
import {
  pairPhotosByCaptureTime,
  groupVideosIndividually,
  TENTATIVE_ROOM_LABEL,
} from "@/app/portal/_lib/roomAutoPairing";
import { classifyRoomsAsync } from "@/app/portal/_lib/roomClassify";

// /portal/submit の本体フォーム。項目構成は現行のGoogle標準フォーム
// (fudosan-video/docs/forms_v15/standard_form.gs が拾う質問)と同じ:
//   マイソク / そのまま使用する写真 / アスペクト比 / 取引種別
// +通知メール(GASでは回答者メール自動取得だった分を明示入力に)。
// +魅力メモ(appeal_note・2026-07-17追加・GAS標準フォームには無い新項目。
//   任意・自由記入・n8n Parse Form Data が空文字fail-softで受ける)。
// 秘密鍵の質問だけはポータルでは不要 — ログイン済みなのでサーバー側が
// 契約社シートから取得する(鍵はブラウザに一切来ない)。
//
// 送信フロー: init(execフォルダ作成)→ ファイルごとに upload-url →
// ブラウザから Drive session URL へ直接 PUT(進捗表示付き)→ submit。
// 二重送信ガード: phase !== "idle" の間はボタン無効。実送信成功後は
// /portal?submitted=1 へリダイレクト。ドライラン(送信フラグOFF)は
// 「送信機能は準備中です」+検証サマリを表示する。

type UploadState = "wait" | "uploading" | "done" | "error";

interface UploadItem {
  label: string;
  pct: number;
  state: UploadState;
}

// 🔗 部屋の動線つながり指定は β として凍結(2026-08-08 岡本判断)。
// 2回の監査で8件のバグを出し、うち1件は🔗未使用の全顧客のプロンプトを汚染して
// いた。顧客からの要望も無いため、UIだけ伏せて配線は温存する
// (link_prev は常に false → n8n側の _linkHint は常に '' → 導入前と同一挙動)。
// 再開するときはこの定数を true にするだけ。
const LINK_ROOMS_BETA = false;

type Phase = "idle" | "working" | "done_dry" | "ambiguous";

interface DryRunResult {
  message: string;
  execId: string;
  photoCount: number;
  payloadJson: string;
}

const ASPECT_LABELS: Record<AspectRatio, string> = {
  "9:16": "9:16 縦型(リール/TikTok・推奨)",
  "1:1": "1:1 正方形",
};

const DEAL_LABELS: Record<DealType, string> = {
  rental: "賃貸",
  sale: "売買",
};

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(n / 1024))}KB`;
}

/** Drive resumable session URL へファイルを PUT(XHRで進捗取得)。
 * 成功時は Drive fileId を返す。 */
function putFileToDrive(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as { id?: string };
          if (json.id) {
            resolve(json.id);
          } else {
            reject(new Error("アップロード応答にファイルIDがありません"));
          }
        } catch {
          reject(new Error("アップロード応答の解析に失敗しました"));
        }
      } else {
        // TODO(実弾後ハードニング): 顧客向けエラーに生HTTPステータスを
        // 出している(app/api/portal/submit/route.ts の同種の生ステータス
        // 露出とセットで直す)。
        reject(new Error(`アップロードに失敗しました (HTTP ${xhr.status})`));
      }
    };
    xhr.onerror = () =>
      reject(new Error("アップロード中に通信エラーが発生しました"));
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );
    xhr.send(file);
  });
}

async function postJson(
  path: string,
  body: unknown
): Promise<{ res: Response; data: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

/** 部屋カードUI(Phase A)専用: 画像の長辺(px)を取得する。読めない場合は
 * null(fail-soft — 判定できないだけで警告を出さない)。 */
function readImageLongSide(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const longSide = Math.max(img.naturalWidth, img.naturalHeight);
      resolve(longSide > 0 ? longSide : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/** 部屋カードUI(Phase A)専用: 動画の長さ(秒)を取得する。読めない場合は
 * null(30秒超の判定はできないが、ブロックはしない=fail-soft)。 */
function readVideoDurationSec(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

export default function SubmitForm({
  defaultEmail,
  roomsUiEnabled = false,
}: {
  defaultEmail: string;
  /** env PORTAL_ROOMS_UI が "true" のときだけ true(サーバーコンポーネント
   * の /portal/submit/page.tsx から渡される)。未指定/false は現行UIを
   * 1行も変えずに維持する(design.md §2のフィーチャーフラグ方針)。 */
  roomsUiEnabled?: boolean;
}) {
  const router = useRouter();
  const [maisoku, setMaisoku] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [aspect, setAspect] = useState<AspectRatio>("9:16");
  const [deal, setDeal] = useState<DealType>("rental");
  const [appealNote, setAppealNote] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [stepNote, setStepNote] = useState("");
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const maisokuInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  // 部屋カードUI(Phase A・roomsUiEnabled時のみ使用。フラグOFF時はこの
  // stateは常に空のまま参照されない=既存挙動に影響しない)。
  const [rooms, setRooms] = useState<RoomCardState[]>([]);
  const roomUidCounter = useRef(0);

  // 入口UIの再設計(2026-07-21・design.md「入口UIの再設計」)。デフォルトは
  // 一括投入(bulk)。「詳しく自分で整理する」で手動カード(Phase A・
  // advanced)に切り替わる — どちらのモードでも同じ rooms state を編集する
  // ため、切り替えても入力内容は失われない。roomsUiEnabled=false のときは
  // どちらも一切参照されない。
  const [roomsMode, setRoomsMode] = useState<"bulk" | "advanced">("bulk");
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);

  // v3.1段3(2026-07-21・誤ペア警告のアクション格上げ・design.md「v3.1段3
  // 仕様」改修2)。「同じ部屋です(このまま)」で恒久ミュートしたペアの
  // キー集合。RoomCardsField.tsx の pairMuteKey(=ファイル実体の
  // name+size+lastModifiedから順序非依存に導出)と同じ形のキーを受け取る
  // だけ — このコンポーネントはキーの中身に関知しない。SubmitForm側の
  // stateとして保持するため、警告UI自体が再マウントされても消えない
  // (bulk確認モードのみで使用・advancedモードには渡さない)。
  const [mutedPairKeys, setMutedPairKeys] = useState<Set<string>>(new Set());

  function mutePairMismatch(key: string) {
    setMutedPairKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  const busy = phase === "working";

  function handleMaisokuPick(files: FileList | null) {
    setError("");
    const file = files?.[0];
    if (!file) return;
    const check = checkMaisokuFile(file.name, file.type, file.size);
    if (!check.ok) {
      setError(check.error || "このファイルは使用できません");
      return;
    }
    setMaisoku(file);
  }

  function handlePhotosPick(files: FileList | null) {
    setError("");
    if (!files || files.length === 0) return;
    const next = [...photos];
    for (const file of Array.from(files)) {
      const check = checkPhotoFile(file.name, file.type, file.size);
      if (!check.ok) {
        setError(check.error || "このファイルは使用できません");
        return;
      }
      // 同名+同サイズは重複追加しない
      if (!next.some((f) => f.name === file.name && f.size === file.size)) {
        next.push(file);
      }
    }
    // 2026-08-07 岡本指摘: 「2枚1組×10部屋=20枚のはずなのに10枚で弾かれる」。
    // MAX_PHOTOS(=10)は1部屋1枚時代の遺物で、2枚1組の現行仕様と矛盾していた。
    // 上限は部屋カードの容量(MAX_ROOMS×MAX_ROOM_PHOTOS_PER_CARD)に一致させる
    // — 自動仕分け側(bulk)の photoCapacity と同じ式。
    const bulkPhotoCap = MAX_TOTAL_PHOTOS;
    if (next.length > bulkPhotoCap) {
      setError(`写真は最大${bulkPhotoCap}枚までです(現在${next.length}枚選択されています)`);
      return;
    }
    setPhotos(next);
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  // --- 部屋カードUI(Phase A)ハンドラ群。roomsUiEnabled=falseの間は
  // どこからも呼ばれない(RoomCardsFieldがrender されないため)。 ---

  function addRoom() {
    if (rooms.length >= MAX_ROOMS) return;
    roomUidCounter.current += 1;
    const uid = `room-${roomUidCounter.current}`;
    setRooms((prev) => [...prev, { uid, label: null, customLabelMode: false, items: [] }]);
  }

  // ファイルの誤ドロップでブラウザがそのファイルへ遷移し、入力中のフォームが
  // 丸ごと消える事故を防ぐ(2026-08-08 監査)。ドロップ枠の外に落とされた場合だけ
  // 既定動作を止める — 枠内のハンドラは stopPropagation せずとも先に処理されるため
  // 通常の投入は妨げない。
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      if (e.defaultPrevented) return; // 枠内で処理済みなら触らない
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types) : [];
      if (!types.includes("Files")) return;
      e.preventDefault();
      if (e.type === "drop" && e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  // 🔗 の不変条件(2026-08-07 監査): linkPrev は「1つ前の部屋との関係」であって
  // 部屋自身の属性ではない。構造が変わった(削除・並べ替え)のに flag だけ残ると
  // 顧客が指定していない相手と繋がってしまうため、影響を受けた位置の flag を落とす。
  // 先頭は前が存在しないので常に非連結。
  function withLinkInvariants(list: RoomCardState[]): RoomCardState[] {
    return list.map((r, i) =>
      i === 0 && r.linkPrev ? { ...r, linkPrev: false } : r
    );
  }

  function removeRoom(uid: string) {
    setRooms((prev) => {
      const idx = prev.findIndex((r) => r.uid === uid);
      if (idx < 0) return prev;
      const next = prev.filter((r) => r.uid !== uid);
      // 消えた部屋を指していた🔗は無効化(繰り上がった別の部屋と勝手に繋がない)
      if (idx < next.length && next[idx].linkPrev) {
        next[idx] = { ...next[idx], linkPrev: false };
      }
      return withLinkInvariants(next);
    });
  }

  function moveRoom(uid: string, dir: -1 | 1) {
    setRooms((prev) => {
      const idx = prev.findIndex((r) => r.uid === uid);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      // 入れ替えで隣接が変わる位置(当事者2つ+その次)の🔗を落とす
      const touched = new Set([idx, swapIdx, Math.max(idx, swapIdx) + 1]);
      return withLinkInvariants(
        next.map((r, i) => (touched.has(i) && r.linkPrev ? { ...r, linkPrev: false } : r))
      );
    });
  }

  function setRoomLabelChip(uid: string, chip: string) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.uid !== uid) return r;
        if (chip === ROOM_LABEL_OTHER) {
          return { ...r, customLabelMode: true };
        }
        if (r.label === chip && !r.customLabelMode) {
          return { ...r, label: null }; // 同じチップの再クリックで解除(任意項目)
        }
        return { ...r, label: chip, customLabelMode: false };
      })
    );
  }

  function setRoomLabelCustomText(uid: string, text: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.uid === uid ? { ...r, label: text.length > 0 ? text.slice(0, 50) : null } : r
      )
    );
  }

  function removeRoomItem(uid: string, itemIdx: number) {
    setRooms((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, items: r.items.filter((_, i) => i !== itemIdx) } : r))
    );
  }

  function swapRoomFrames(uid: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.uid === uid && r.items.length === 2 ? { ...r, items: [r.items[1], r.items[0]] } : r
      )
    );
  }

  function setPhotoItemLowRes(uid: string, itemIdx: number, lowRes: boolean) {
    setRooms((prev) =>
      prev.map((r) =>
        r.uid !== uid
          ? r
          : {
              ...r,
              items: r.items.map((it, i) =>
                i === itemIdx && it.kind === "photo" ? { ...it, lowRes } : it
              ),
            }
      )
    );
  }

  function setVideoItemDuration(uid: string, itemIdx: number, durationSec: number) {
    setRooms((prev) =>
      prev.map((r) =>
        r.uid !== uid
          ? r
          : {
              ...r,
              items: r.items.map((it, i) =>
                i === itemIdx && it.kind === "video" ? { ...it, durationSec } : it
              ),
            }
      )
    );
  }

  // P3(部屋名Vision自動下書き・2026-07-22・design.md「UIテスト実測レポート」
  // P3改修)。Vision分類の結果を部屋へ適用してよいかを、適用しようとする
  // その瞬間の最新state内で再判定する(setRoomsの関数型更新の内側で完結
  // させる — 分類は非同期なので、リクエスト送出後に顧客がその部屋の
  // ラベルを触っている可能性があり、古いclosureのroomsを見ると判定が
  // 古くなるため)。
  //
  // 「未設定」の定義: label===null(手動カードUIの初期状態=addRoom()の
  // まま)、または label===TENTATIVE_ROOM_LABEL(="お部屋"・自動仕分けで
  // ファイル名ヒントが効かなかった場合の既定プレースホルダ)。どちらも
  // 「顧客がまだ触っていない」ことを表す値 — 顧客が既知チップを選んだ
  // (label=チップ文字列・customLabelMode=false)場合、あるいは自由記入欄に
  // 何か入力した(label=お部屋でも null でもない文字列)場合は対象外にする
  // (「担当者一次情報の原則」— 顧客の入力を機械が上書きしない)。
  // 適用後に顧客が変更すれば、setRoomLabelChip/setRoomLabelCustomTextが
  // 同じ rooms state を書き換えるだけなので当然そちらが勝つ。
  function applyAutoRoomLabel(uid: string, label: string) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.uid !== uid) return r;
        const isUnset = r.label === null || r.label === TENTATIVE_ROOM_LABEL;
        if (!isUnset) return r;
        return { ...r, label, customLabelMode: false };
      })
    );
  }

  // 🔗 直前の部屋とのつながりトグル(2026-08-07 岡本発案)。
  function toggleLinkPrev(uid: string) {
    setRooms((prev) =>
      prev.map((r, i) =>
        r.uid === uid && i > 0 ? { ...r, linkPrev: !r.linkPrev } : r
      )
    );
  }

  function addPhotosToRoom(uid: string, files: FileList) {
    setError("");
    const room = rooms.find((r) => r.uid === uid);
    if (!room) return;
    if (room.items.some((it) => it.kind === "video")) return; // 写真/動画は排他
    const capacity = MAX_ROOM_PHOTOS_PER_CARD - room.items.length;
    const picked = Array.from(files);
    if (picked.length === 0) return;
    if (picked.length > capacity) {
      setError(`このカードに追加できる写真はあと${capacity}枚です`);
      return;
    }
    for (const file of picked) {
      const check = checkPhotoFile(file.name, file.type, file.size);
      if (!check.ok) {
        setError(check.error || "このファイルは使用できません");
        return;
      }
    }
    const startIdx = room.items.length;
    setRooms((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? {
              ...r,
              items: [
                ...r.items,
                ...picked.map((file) => ({ kind: "photo" as const, file, lowRes: null })),
              ],
            }
          : r
      )
    );
    // 長辺チェックは非同期(fail-soft・送信は妨げない・§2)
    picked.forEach((file, i) => {
      readImageLongSide(file).then((longSide) => {
        setPhotoItemLowRes(uid, startIdx + i, longSide !== null && longSide < ROOM_PHOTO_MIN_LONG_SIDE);
      });
    });

    // P3(部屋名Vision自動下書き): このカードにとって「始まりの1枚」が
    // 初めて確定した瞬間(startIdx===0=このカードは呼び出し前は空だった)
    // だけ非同期発火する。「1部屋=1判定」はstart写真基準(design.md
    // 「UIテスト実測レポート」P3)なので、後から「+2枚目を追加」で
    // 終わりの1枚が入る呼び出し(startIdx===1)では再分類しない — その
    // 時点でstart写真は変わっておらず、この関数がstartIdx===0で呼ばれた
    // 時に既に分類済みのため。手動カードUI(advancedモード)の最初の
    // 「+ 写真を追加」呼び出しもこの関数を通るため、自動仕分け(bulk)・
    // 手動カード(advanced)のどちらも同じ条件で1回だけ発火する。
    if (startIdx === 0) {
      void classifyRoomsAsync([{ uid, file: picked[0] }], applyAutoRoomLabel);
    }
  }

  function addVideoToRoom(uid: string, file: File) {
    setError("");
    const room = rooms.find((r) => r.uid === uid);
    if (!room || room.items.length > 0) return; // 写真/動画は排他・1本まで
    const check = checkVideoFile(file.name, file.type, file.size);
    if (!check.ok) {
      setError(check.error || "このファイルは使用できません");
      return;
    }
    setRooms((prev) =>
      prev.map((r) =>
        r.uid === uid ? { ...r, items: [{ kind: "video" as const, file, durationSec: null }] } : r
      )
    );
    // 尺チェックは非同期。30秒超は拒否(§2・fail-hard)。
    readVideoDurationSec(file).then((duration) => {
      if (duration !== null && duration > MAX_VIDEO_DURATION_SEC) {
        setError(
          `${file.name}: 動画は${MAX_VIDEO_DURATION_SEC}秒以内でアップロードしてください(${Math.round(duration)}秒でした)`
        );
        setRooms((prev) => prev.map((r) => (r.uid === uid ? { ...r, items: [] } : r)));
        return;
      }
      setVideoItemDuration(uid, 0, duration ?? 0);
    });
  }

  // --- 一括投入(bulk)専用ハンドラ群。roomsMode==="bulk"のときだけ
  // BulkRoomIntake/確認画面から呼ばれる。ペアリングはクライアント完結
  // (サーバー往復なし・LLM不要・design.md「自動ペアリング確認UI実装
  // spec」)。生成した rooms は上の手動カードハンドラ群(setRoomLabelChip
  // 等)や送信処理(handleRoomsSubmit)とまったく同じ state/経路を使う —
  // データ層はPhase Aと共通のため、送信ロジックには一切手を入れていない。
  //
  // 入稿UI仕様v3(2026-07-21岡本裁定)以降、写真タブ/動画タブは別ピッカー
  // (accept属性も分離・混在選択不可)。どちらのタブから追加しても既存の
  // rooms へ「合流」する(置き換えない)ため、両タブを行き来しながら
  // 部屋を積み増せる。

  function resetBulkRooms() {
    setError("");
    setRooms([]);
  }

  async function handleBulkPhotosSelected(files: FileList) {
    setError("");
    const picked = Array.from(files);
    if (picked.length === 0) return;
    for (const file of picked) {
      const check = checkPhotoFile(file.name, file.type, file.size);
      if (!check.ok) {
        setError(check.error || "このファイルは使用できません");
        return;
      }
    }

    const existingPhotoCount = rooms.reduce(
      (sum, r) => sum + r.items.filter((it) => it.kind === "photo").length,
      0
    );
    const photoCapacity = MAX_ROOMS * MAX_ROOM_PHOTOS_PER_CARD - existingPhotoCount;
    if (picked.length > photoCapacity) {
      setError(`写真は一度に最大${Math.max(photoCapacity, 0)}枚まで追加できます(現在${picked.length}枚選択されています)`);
      return;
    }

    setBulkAnalyzing(true);
    try {
      // 時系列連続ペアリング(EXIF撮影時刻→lastModified→選択順の優先度で
      // 昇順ソートし、前から2枚ずつ組む。design.md「入稿UI仕様v3」)。
      const groups = await pairPhotosByCaptureTime(picked);
      if (rooms.length + groups.length > MAX_ROOMS) {
        setError(
          `部屋数が多すぎます(追加すると${rooms.length + groups.length}部屋・上限${MAX_ROOMS})。写真の点数を減らすか、「詳しく自分で整理する」をお試しください`
        );
        return;
      }
      const newRooms: RoomCardState[] = groups.map((g) => {
        roomUidCounter.current += 1;
        const uid = `room-${roomUidCounter.current}`;
        const items: RoomLocalItem[] = g.files.map((file) => ({
          kind: "photo" as const,
          file,
          lowRes: null,
        }));
        return { uid, label: g.label, customLabelMode: g.customLabelMode, items };
      });
      setRooms((prev) => [...prev, ...newRooms]);

      // 長辺チェックは既存の手動モードと同じ非同期チェックを流用する
      // (fail-soft・§2のバリデーション文言と統一するため)。
      newRooms.forEach((room) => {
        room.items.forEach((it, ii) => {
          readImageLongSide(it.file).then((longSide) => {
            setPhotoItemLowRes(room.uid, ii, longSide !== null && longSide < ROOM_PHOTO_MIN_LONG_SIDE);
          });
        });
      });

      // P3(部屋名Vision自動下書き): 一括投入で新規作成された部屋ごとに、
      // 「始まりの1枚」(items[0])だけを分類する(「1部屋=1判定」・
      // design.md「UIテスト実測レポート」P3改修)。groupsはこのハンドラ
      // (写真タブ専用)が作るため常にkind==="photo"だが、念のためkindで
      // 絞ってから渡す(動画部屋はスキップという要件を型に頼らず明示)。
      void classifyRoomsAsync(
        newRooms
          .filter((r) => r.items[0]?.kind === "photo")
          .map((r) => ({ uid: r.uid, file: r.items[0].file })),
        applyAutoRoomLabel
      );
    } catch {
      setError("写真の自動振り分けに失敗しました。「詳しく自分で整理する」から手動で整理してください");
    } finally {
      setBulkAnalyzing(false);
    }
  }

  function handleBulkVideoSelected(files: FileList) {
    setError("");
    const picked = Array.from(files);
    if (picked.length === 0) return;
    for (const file of picked) {
      const check = checkVideoFile(file.name, file.type, file.size);
      if (!check.ok) {
        setError(check.error || "このファイルは使用できません");
        return;
      }
    }

    const existingVideoCount = rooms.reduce(
      (sum, r) => sum + r.items.filter((it) => it.kind === "video").length,
      0
    );
    if (existingVideoCount + picked.length > MAX_VIDEOS) {
      setError(`動画は一度に最大${MAX_VIDEOS}本までです(追加すると${existingVideoCount + picked.length}本になります)`);
      return;
    }
    if (rooms.length + picked.length > MAX_ROOMS) {
      setError(`部屋数が多すぎます(追加すると${rooms.length + picked.length}部屋・上限${MAX_ROOMS})`);
      return;
    }

    const groups = groupVideosIndividually(picked);
    const newRooms: RoomCardState[] = groups.map((g) => {
      roomUidCounter.current += 1;
      const uid = `room-${roomUidCounter.current}`;
      return {
        uid,
        label: g.label,
        customLabelMode: g.customLabelMode,
        items: [{ kind: "video" as const, file: g.files[0], durationSec: null }],
      };
    });
    setRooms((prev) => [...prev, ...newRooms]);

    // 尺チェックは既存の手動モードと同じ非同期チェックを流用(30秒超は
    // 拒否・fail-hard=§2)。超過時はカードを消さず items を空にして
    // 再投入を促す(手動追加時のaddVideoToRoomと同じ挙動)。
    newRooms.forEach((room) => {
      const file = room.items[0].file;
      readVideoDurationSec(file).then((duration) => {
        if (duration !== null && duration > MAX_VIDEO_DURATION_SEC) {
          setError(
            `${file.name}: 動画は${MAX_VIDEO_DURATION_SEC}秒以内でアップロードしてください(${Math.round(duration)}秒でした)`
          );
          setRooms((prev) => prev.map((r) => (r.uid === room.uid ? { ...r, items: [] } : r)));
          return;
        }
        setVideoItemDuration(room.uid, 0, duration ?? 0);
      });
    });
  }

  function moveRoomItemToRoom(fromUid: string, itemIdx: number, toUid: string) {
    if (fromUid === toUid) return;
    setError("");
    setRooms((prev) => {
      const fromRoom = prev.find((r) => r.uid === fromUid);
      const toRoom = prev.find((r) => r.uid === toUid);
      const item = fromRoom?.items[itemIdx];
      if (!fromRoom || !toRoom || !item) return prev;
      if (item.kind === "video" ? toRoom.items.length > 0 : toRoom.items.some((it) => it.kind === "video")) {
        setError("動画のある部屋には移動できません");
        return prev;
      }
      if (item.kind === "photo" && toRoom.items.length >= MAX_ROOM_PHOTOS_PER_CARD) {
        setError("移動先の部屋はすでに写真が2枚あります。先に入れ替えるか、別の部屋へ移動してください");
        return prev;
      }
      const next = prev
        .map((r) => {
          if (r.uid === fromUid) return { ...r, items: r.items.filter((_, i) => i !== itemIdx) };
          if (r.uid === toUid) return { ...r, items: [...r.items, item] };
          return r;
        })
        .filter((r) => r.items.length > 0 || r.uid === toUid);
      // 🔗(2026-08-08 監査): 空になった部屋が配列から消えると、その直後だった
      // 部屋の linkPrev は「もう存在しない相手」を指す。removeRoom と同じ流儀で
      // 前の部屋が変わった要素の flag を落とす(顧客未指定の連結を作らない)。
      const prevUidAt = new Map<string, string | null>();
      prev.forEach((r, i) => prevUidAt.set(r.uid, i > 0 ? prev[i - 1].uid : null));
      const repaired = next.map((r, i) => {
        const before = i > 0 ? next[i - 1].uid : null;
        return r.linkPrev && prevUidAt.get(r.uid) !== before
          ? { ...r, linkPrev: false }
          : r;
      });
      return withLinkInvariants(repaired);
    });
  }

  // v3.1段2(2026-07-21・写真タイルのポインタDnD・design.md「UI v3.1改修+
  // 誤ペア三重ガード」段2)。同じ部屋内(start/end入替=既存swapRoomFramesと
  // 同義)・別の部屋間のどちらも同じ意味論で扱う。2枚の位置(itemIdx)だけを
  // 入れ替えるため各部屋のitems件数は不変 — 容量上限/写真動画排他の
  // invariantは件数が変わらないことから自動的に保たれる(追加チェック不要)。
  // 対象はphoto同士のみ(useRoomItemDragのdata-drop-photoはphotoアイテムに
  // しか付与されないため呼ばれないが、念のためkindを再検証しfail-softに
  // 無視する)。
  //
  // 検証済み: 入替後はroom.items[0]/[1]のFile参照が入れ替わるため、段1の
  // PairMismatchWarning(PairPhotosBlock内・依存配列[fileA, fileB])はFile
  // 参照の変化だけで再計算が走る仕様(RoomCardsField.tsx該当コメント参照)。
  // 組が変われば警告も自然に発火し直す。
  function swapRoomItems(
    a: { uid: string; itemIdx: number },
    b: { uid: string; itemIdx: number }
  ) {
    if (a.uid === b.uid && a.itemIdx === b.itemIdx) return;
    setError("");
    setRooms((prev) => {
      const next = prev.map((r) => ({ ...r, items: [...r.items] }));
      const roomA = next.find((r) => r.uid === a.uid);
      const roomB = next.find((r) => r.uid === b.uid);
      const itemA = roomA?.items[a.itemIdx];
      const itemB = roomB?.items[b.itemIdx];
      if (!roomA || !roomB || !itemA || !itemB) return prev;
      if (itemA.kind !== "photo" || itemB.kind !== "photo") return prev;
      roomA.items[a.itemIdx] = itemB;
      roomB.items[b.itemIdx] = itemA;
      return next;
    });
  }

  function unpairRoom(uid: string) {
    setError("");
    setRooms((prev) => {
      const idx = prev.findIndex((r) => r.uid === uid);
      if (idx < 0) return prev;
      const room = prev[idx];
      if (room.items.length !== 2 || room.items.some((it) => it.kind !== "photo")) return prev;
      if (prev.length >= MAX_ROOMS) {
        setError(`部屋数が上限(${MAX_ROOMS})に達しているため、ペア解除で部屋を増やせません。先に他の部屋を削除してください`);
        return prev;
      }
      roomUidCounter.current += 1;
      const newUid = `room-${roomUidCounter.current}`;
      const roomA: RoomCardState = { ...room, items: [room.items[0]] };
      const roomB: RoomCardState = {
        uid: newUid,
        label: room.label,
        customLabelMode: room.customLabelMode,
        items: [room.items[1]],
        // 分割前は1つの部屋=物理的に連続しているので🔗を引き継ぐ(2026-08-07監査)
        linkPrev: true,
      };
      const next = [...prev];
      next.splice(idx, 1, roomA, roomB);
      return next;
    });
  }

  const legacyCanSubmit =
    !!maisoku && photos.length >= 1 && email.trim().length > 3 && !busy;
  const roomsCanSubmit =
    !!maisoku &&
    rooms.length >= 1 &&
    rooms.every((r) => r.items.length >= 1) &&
    email.trim().length > 3 &&
    !busy;
  const canSubmit = roomsUiEnabled ? roomsCanSubmit : legacyCanSubmit;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 部屋カードUI(Phase A)は完全に独立した送信経路(下のhandleRoomsSubmit)
    // へ分岐する。ここから先(既存のフラット写真配列を前提にした送信処理)
    // は roomsUiEnabled=false のとき従来と1バイトも変わらない。
    if (roomsUiEnabled) {
      await handleRoomsSubmit();
      return;
    }
    if (!canSubmit || !maisoku) return;

    // 費用系ワードのソフトガード(app/revise/_components/ReviseForm.tsx の
    // COST_WARNING_KEYWORDS と同じ流儀)。魅力メモ(自由記入)がここに
    // 該当したら送信前に一度だけ確認する。ブロックはしない — OKなら
    // 通常通り送信を続行する。アップロード開始前(=通信が始まる前)に
    // 確認するため、他のバリデーションより先に行う。
    if (containsCostWarningKeyword(appealNote)) {
      const proceed = window.confirm(
        "費用に関する表現が含まれています。マイソク等の事実に基づく内容であることをご確認ください。このまま送信しますか?"
      );
      if (!proceed) return;
    }

    setError("");
    setDryRun(null);
    setPhase("working");

    const items: UploadItem[] = [
      { label: `マイソク: ${maisoku.name}`, pct: 0, state: "wait" },
      ...photos.map((f) => ({
        label: `写真: ${f.name}`,
        pct: 0,
        state: "wait" as UploadState,
      })),
    ];
    setUploads(items);

    const setItem = (i: number, patch: Partial<UploadItem>) =>
      setUploads((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
      );

    try {
      // 1) exec フォルダ作成
      setStepNote("アップロード先を準備しています…");
      const init = await postJson("/api/portal/submit/init", {});
      if (!init.res.ok || !init.data.ok) {
        throw new Error(
          (init.data.error as string) || "アップロード準備に失敗しました"
        );
      }
      const token = init.data.token as string;

      // 2) ファイルアップロード(マイソク→写真の順に直列・進捗表示)
      setStepNote("ファイルをアップロードしています…");
      const uploadOne = async (
        file: File,
        target: "maisoku" | "photo",
        index: number,
        itemIdx: number
      ): Promise<string> => {
        setItem(itemIdx, { state: "uploading" });
        const urlRes = await postJson("/api/portal/submit/upload-url", {
          token,
          target,
          name: file.name,
          mime_type: file.type,
          size: file.size,
          index,
        });
        if (!urlRes.res.ok || !urlRes.data.ok) {
          setItem(itemIdx, { state: "error" });
          throw new Error(
            (urlRes.data.error as string) || "アップロード準備に失敗しました"
          );
        }
        try {
          const fileId = await putFileToDrive(
            urlRes.data.upload_url as string,
            file,
            (pct) => setItem(itemIdx, { pct })
          );
          setItem(itemIdx, { pct: 100, state: "done" });
          return fileId;
        } catch (err) {
          setItem(itemIdx, { state: "error" });
          throw err;
        }
      };

      const maisokuFileId = await uploadOne(maisoku, "maisoku", 0, 0);
      const photoFileIds: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        photoFileIds.push(await uploadOne(photos[i], "photo", i, i + 1));
      }

      // 3) 送信(サーバーがペイロード組み立て+送信ゲート判定)
      setStepNote("リクエストを送信しています…");
      // FIX-2: このfetch自体が失敗した(ネットワーク断等)場合、サーバー
      // 側では送信(dispatch)が実際に成立している可能性がある。無条件で
      // ボタンを復帰させて再送信させると二重送信の危険があるため、
      // ここだけ専用にcatchして「送信済みかもしれません」へ誘導する
      // (通常のバリデーションエラー等=submit.res自体は返ってきている
      // ケースは、下の !submit.res.ok 分岐で従来どおり扱う)。
      let submit: { res: Response; data: Record<string, unknown> };
      try {
        submit = await postJson("/api/portal/submit", {
          token,
          maisoku_file_id: maisokuFileId,
          photo_file_ids: photoFileIds,
          aspect_ratio: aspect,
          deal_type: deal,
          email: email.trim(),
          appeal_note: appealNote.trim(),
        });
      } catch {
        setPhase("ambiguous");
        setStepNote("");
        return;
      }
      if (!submit.res.ok || !submit.data.ok) {
        throw new Error(
          (submit.data.error as string) || "送信に失敗しました"
        );
      }

      if (submit.data.sent === true) {
        // 実送信成功 → ダッシュボードへ(二重送信防止のためこの画面を離れる)
        router.push("/portal?submitted=1");
        router.refresh();
        return;
      }

      // ドライラン(送信フラグOFF)
      setDryRun({
        message:
          (submit.data.message as string) || "送信機能は準備中です",
        execId: (submit.data.exec_id as string) || "",
        photoCount:
          typeof submit.data.photo_count === "number"
            ? submit.data.photo_count
            : photoFileIds.length,
        payloadJson: JSON.stringify(submit.data.payload ?? {}, null, 2),
      });
      setPhase("done_dry");
      setStepNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPhase("idle");
      setStepNote("");
    }
  }

  // 部屋カードUI(Phase A)専用の送信経路。上のhandleSubmit本体(現行UI)を
  // 一切書き換えずに済むよう、あえて独立させている(重複はあるが「フラグ
  // OFF時に現行UIと同一」を機械的に保証するための意図的な選択)。
  // デュアルペイロード(design.md §1「後方互換」): photo_file_ids は従来
  // どおり写真Drive IDの配列(roomsをorder順にflattenして生成)、加えて
  // 新フィールド rooms を同送する。n8nがrooms未対応でもphoto_file_ids等の
  // 旧フィールドは今までと完全に同じ形のまま届く。
  async function handleRoomsSubmit() {
    if (!maisoku || !roomsCanSubmit) return;

    // Phase D v0の制約: 動画のみのご依頼は未対応(本体WFの写真ループが起点のため)。
    // 写真の部屋が1つ以上あれば動画部屋は混在可。v1(動画のみ対応)で撤去予定。
    const hasPhotoRoom = rooms.some((r) => r.items.some((it) => it.kind === "photo"));
    if (!hasPhotoRoom) {
      setError(
        "動画のみのご依頼は現在準備中です。お手数ですが、写真の部屋(2枚1組または1枚)も1つ以上あわせてご登録ください"
      );
      return;
    }

    if (containsCostWarningKeyword(appealNote)) {
      const proceed = window.confirm(
        "費用に関する表現が含まれています。マイソク等の事実に基づく内容であることをご確認ください。このまま送信しますか?"
      );
      if (!proceed) return;
    }

    setError("");
    setDryRun(null);
    setPhase("working");

    interface FlatUploadTarget {
      roomUid: string;
      itemIdx: number;
      item: RoomLocalItem;
      progressLabel: string;
    }
    const flatTargets: FlatUploadTarget[] = [];
    rooms.forEach((r, ri) => {
      const roomTag = r.label ? `部屋${ri + 1}(${r.label})` : `部屋${ri + 1}`;
      r.items.forEach((it, ii) => {
        flatTargets.push({
          roomUid: r.uid,
          itemIdx: ii,
          item: it,
          progressLabel: `${roomTag} ${it.kind === "photo" ? `写真${ii + 1}` : "動画"}: ${it.file.name}`,
        });
      });
    });

    const items: UploadItem[] = [
      { label: `マイソク: ${maisoku.name}`, pct: 0, state: "wait" },
      ...flatTargets.map((t) => ({ label: t.progressLabel, pct: 0, state: "wait" as UploadState })),
    ];
    setUploads(items);

    const setItem = (i: number, patch: Partial<UploadItem>) =>
      setUploads((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
      );

    try {
      setStepNote("アップロード先を準備しています…");
      const init = await postJson("/api/portal/submit/init", {});
      if (!init.res.ok || !init.data.ok) {
        throw new Error(
          (init.data.error as string) || "アップロード準備に失敗しました"
        );
      }
      const token = init.data.token as string;

      setStepNote("ファイルをアップロードしています…");
      const uploadOne = async (
        file: File,
        target: "maisoku" | "photo" | "video",
        index: number,
        itemIdx: number
      ): Promise<string> => {
        setItem(itemIdx, { state: "uploading" });
        const urlRes = await postJson("/api/portal/submit/upload-url", {
          token,
          target,
          name: file.name,
          mime_type: file.type,
          size: file.size,
          index,
        });
        if (!urlRes.res.ok || !urlRes.data.ok) {
          setItem(itemIdx, { state: "error" });
          throw new Error(
            (urlRes.data.error as string) || "アップロード準備に失敗しました"
          );
        }
        try {
          const fileId = await putFileToDrive(
            urlRes.data.upload_url as string,
            file,
            (pct) => setItem(itemIdx, { pct })
          );
          setItem(itemIdx, { pct: 100, state: "done" });
          return fileId;
        } catch (err) {
          setItem(itemIdx, { state: "error" });
          throw err;
        }
      };

      const maisokuFileId = await uploadOne(maisoku, "maisoku", 0, 0);

      let photoIdx = 0;
      let videoIdx = 0;
      const driveIdByKey = new Map<string, string>();
      for (let t = 0; t < flatTargets.length; t++) {
        const target = flatTargets[t];
        const index = target.item.kind === "photo" ? photoIdx++ : videoIdx++;
        const driveId = await uploadOne(target.item.file, target.item.kind, index, t + 1);
        driveIdByKey.set(`${target.roomUid}:${target.itemIdx}`, driveId);
      }

      const photoFileIds: string[] = [];
      const roomsPayload: RoomPayload[] = rooms.map((r, ri) => ({
        order: ri + 1,
        label: r.label,
        // 🔗 先頭カードは常に連結なし(前が存在しないため)
        link_prev: ri > 0 && r.linkPrev === true,
        items: r.items.map((it, ii) => {
          const driveId = driveIdByKey.get(`${r.uid}:${ii}`) ?? "";
          if (it.kind === "photo") {
            photoFileIds.push(driveId);
            const frameRole: RoomFrameRole =
              r.items.length >= 2 && ii === 1 ? "end" : "start";
            return { kind: "photo" as const, drive_id: driveId, frame_role: frameRole };
          }
          return {
            kind: "video" as const,
            drive_id: driveId,
            duration_sec: Math.round(it.durationSec ?? 0),
          };
        }),
      }));

      // 3) 送信(サーバーがペイロード組み立て+送信ゲート判定)
      setStepNote("リクエストを送信しています…");
      let submit: { res: Response; data: Record<string, unknown> };
      try {
        submit = await postJson("/api/portal/submit", {
          token,
          maisoku_file_id: maisokuFileId,
          photo_file_ids: photoFileIds,
          aspect_ratio: aspect,
          deal_type: deal,
          email: email.trim(),
          appeal_note: appealNote.trim(),
          rooms: roomsPayload,
        });
      } catch {
        setPhase("ambiguous");
        setStepNote("");
        return;
      }
      if (!submit.res.ok || !submit.data.ok) {
        throw new Error(
          (submit.data.error as string) || "送信に失敗しました"
        );
      }

      if (submit.data.sent === true) {
        router.push("/portal?submitted=1");
        router.refresh();
        return;
      }

      setDryRun({
        message:
          (submit.data.message as string) || "送信機能は準備中です",
        execId: (submit.data.exec_id as string) || "",
        photoCount:
          typeof submit.data.photo_count === "number"
            ? submit.data.photo_count
            : photoFileIds.length,
        payloadJson: JSON.stringify(submit.data.payload ?? {}, null, 2),
      });
      setPhase("done_dry");
      setStepNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPhase("idle");
      setStepNote("");
    }
  }

  const inputClass =
    "w-full border border-black/10 bg-white/80 text-[var(--brand-ink)] placeholder:text-black/35 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white/95 transition-colors";
  const pickerButtonClass =
    "inline-block cursor-pointer rounded-xl border border-dashed border-black/20 bg-white/60 px-4 py-3 text-sm font-medium text-[var(--brand-ink)]/80 hover:bg-white/90 hover:border-[var(--brand-orange)]/60 transition-colors";

  if (phase === "ambiguous") {
    return (
      <div className="liquid-glass-white rounded-2xl shadow-2xl shadow-black/10 p-6 sm:p-8">
        <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
        <h2 className="text-lg font-bold text-[var(--brand-ink)] text-center">
          送信結果を確認できませんでした
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)] text-center">
          通信エラーにより、送信が完了したかどうかをこの画面では確認できません。送信は完了している可能性があるため、二重送信を避けるためこのまま再送信はせず、マイページで状況をご確認ください。反映されていない場合は担当者までご連絡ください。
        </p>
        <a
          href="/portal"
          className="mt-6 block w-full text-center bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-3 text-sm hover:shadow-lg transition-all active:scale-[0.98]"
        >
          マイページで確認する
        </a>
      </div>
    );
  }

  if (phase === "done_dry" && dryRun) {
    return (
      <div className="liquid-glass-white rounded-2xl shadow-2xl shadow-black/10 p-6 sm:p-8">
        <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
        <h2 className="text-lg font-bold text-[var(--brand-ink)] text-center">
          送信機能は準備中です
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)] text-center">
          {dryRun.message}
        </p>
        <div className="mt-5 rounded-xl bg-white/70 border border-black/5 p-4 text-xs text-[var(--brand-gray)] space-y-1">
          <div>受付ID: {dryRun.execId || "-"}</div>
          <div>アップロード済み写真: {dryRun.photoCount}枚</div>
          <div>リクエスト内容の検証: 合格</div>
        </div>
        <details className="mt-3 text-xs text-[var(--brand-gray-light)]">
          <summary className="cursor-pointer select-none">
            技術情報(確認用ペイロード)
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-3 text-[10px] leading-relaxed">
            {dryRun.payloadJson}
          </pre>
        </details>
        <a
          href="/portal"
          className="mt-6 block w-full text-center bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-3 text-sm hover:shadow-lg transition-all active:scale-[0.98]"
        >
          マイページへ戻る
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      // v3.2(2026-07-22・PCレイアウト対応・design.md「v3.2仕様」): lg+で
      // 2カラム化。DOM順(マイソク→部屋素材→アスペクト比→…→送信ボタン→
      // 注記)はモバイル現状のまま1バイトも変えず、明示的なgrid-column/
      // grid-rowだけで視覚的に並び替える(「部屋素材ゾーン」1個だけが
      // 右カラムへ、残り8項目は下の1個のwrapper divへまとめて左カラムの
      // 2行目に置く=grid行の数を2つに抑えてtrack-sizingの歪みを避ける
      // 設計)。<lg では lg: 系クラスは一切効かないため現状の
      // space-y-6ブロック積みと完全に同一。
      // v3.3(2026-07-23・PC幅活用): Shellがxl:max-w-7xlまで広がる分、
      // lgのままの比率(2fr/3fr)だとフォーム項目(短いテキスト入力中心)の
      // 左カラムが間延びする。xl+だけ左カラムを固定幅(440px)に切り替え、
      // 余った横幅は右カラム(部屋素材ゾーン=写真グリッドが並ぶため広い
      // ほど活きる)に回す。gapもxlで拡大。lg帯の比率(2fr/3fr)自体は
      // 既存のまま変更しない(検収済みレイアウトを壊さないため)。
      className="liquid-glass-white rounded-2xl shadow-2xl shadow-black/10 p-6 sm:p-8 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-x-8 lg:gap-y-6 xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-x-12"
    >
      {/* マイソク */}
      <div className="lg:col-start-1 lg:row-start-1">
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
          マイソク(物件図面) <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-[var(--brand-gray-light)] mb-2">
          PDF または JPEG/PNG を1枚。物件情報はここから自動で読み取ります
        </p>
        <input
          ref={maisokuInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            handleMaisokuPick(e.target.files);
            e.target.value = "";
          }}
        />
        {maisoku ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/70 border border-black/5 px-4 py-3">
            <span className="flex-1 min-w-0 truncate text-sm text-[var(--brand-ink)]">
              {maisoku.name}
            </span>
            <span className="text-xs text-[var(--brand-gray-light)] shrink-0">
              {formatBytes(maisoku.size)}
            </span>
            {!busy && (
              <button
                type="button"
                onClick={() => setMaisoku(null)}
                className="text-xs text-red-500 hover:text-red-600 shrink-0"
              >
                削除
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={pickerButtonClass}
            disabled={busy}
            onClick={() => maisokuInputRef.current?.click()}
          >
            + ファイルを選択
          </button>
        )}
      </div>

      {/* 物件写真(部屋カードUI・PORTAL_ROOMS_UI。デフォルト=一括投入
          bulk・「詳しく自分で整理する」でPhase Aの手動カードadvancedへ。
          design.md「入口UIの再設計」/「自動ペアリング確認UI実装spec」) */}
      {roomsUiEnabled ? (
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
            部屋ごとの写真・動画 <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-[var(--brand-gray-light)] mb-2">
            {roomsMode === "bulk"
              ? "同じ部屋を2枚1組(始まり→終わり)で撮ってアップロードしてください"
              : "部屋を追加して、それぞれに写真(1〜2枚)または動画(1本)を入れてください"}
          </p>
          <a
            href="/portal/guide"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block text-xs font-semibold text-[var(--brand-orange-dark)] underline decoration-[var(--brand-orange)]/40 underline-offset-2 hover:decoration-current"
          >
            📸 魅力的な動画になる写真・動画の撮り方はこちら
          </a>

          {roomsMode === "advanced" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRoomsMode("bulk")}
                className="mb-3 text-xs underline text-[var(--brand-ink)]/50 hover:text-[var(--brand-ink)]/80 disabled:opacity-50"
              >
                ← 一括投入に戻る
              </button>
              <RoomCardsField
                rooms={rooms}
                busy={busy}
                onAddRoom={addRoom}
                onRemoveRoom={removeRoom}
                onMoveRoom={moveRoom}
                onSetLabelChip={setRoomLabelChip}
                onSetLabelCustomText={setRoomLabelCustomText}
                onAddPhotos={addPhotosToRoom}
                onAddVideo={addVideoToRoom}
                onRemoveItem={removeRoomItem}
                onSwapFrames={swapRoomFrames}
              />
            </>
          ) : (
            <>
              <BulkRoomIntake
                busy={busy}
                analyzing={bulkAnalyzing}
                hasRooms={rooms.length > 0}
                onPhotoFilesSelected={handleBulkPhotosSelected}
                onVideoFilesSelected={handleBulkVideoSelected}
                onSwitchToAdvanced={() => setRoomsMode("advanced")}
              />
              {rooms.length > 0 && (
                <>
                  <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[var(--brand-gray-light)]">
                      部屋ごとの一覧です。違っていたら下で自由に直してください(部屋名の変更・写真の入れ替え・別の部屋への移動ができます)
                      {/* DnDヒントはタッチ端末向け(lg未満)のみ。PCはマウス即ドラッグ+全ボタン操作可のため不要 */}
                      <span className="lg:hidden block mt-0.5">
                        👆 写真を<strong>長押し</strong>すると、つまんで別の部屋へ動かせます
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={resetBulkRooms}
                      className="shrink-0 text-xs underline text-[var(--brand-orange-dark)] disabled:opacity-50"
                    >
                      最初からやり直す
                    </button>
                  </div>
                  <RoomCardsField
                    rooms={rooms}
                    busy={busy}
                    onAddRoom={addRoom}
                    onRemoveRoom={removeRoom}
                    onMoveRoom={moveRoom}
                    onSetLabelChip={setRoomLabelChip}
                    onSetLabelCustomText={setRoomLabelCustomText}
                    onAddPhotos={addPhotosToRoom}
                    onAddVideo={addVideoToRoom}
                    onRemoveItem={removeRoomItem}
                    onSwapFrames={swapRoomFrames}
                    onMoveItemToRoom={moveRoomItemToRoom}
                    onUnpairRoom={unpairRoom}
                    onSwapItems={swapRoomItems}
                    mutedPairKeys={mutedPairKeys}
                    onMutePair={mutePairMismatch}
                    onToggleLinkPrev={LINK_ROOMS_BETA ? toggleLinkPrev : undefined}
                  />
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
            物件写真 <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-[var(--brand-gray-light)] mb-2">
            そのまま動画に使用する写真({RECOMMENDED_PHOTOS}推奨・最大
            {MAX_TOTAL_PHOTOS}枚)。JPEG / PNG / WebP
          </p>
          <a
            href="/portal/guide"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block text-xs font-semibold text-[var(--brand-orange-dark)] underline decoration-[var(--brand-orange)]/40 underline-offset-2 hover:decoration-current"
          >
            📸 魅力的な動画になる写真の撮り方はこちら
          </a>
          <input
            ref={photosInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              handlePhotosPick(e.target.files);
              e.target.value = "";
            }}
          />
          {photos.length > 0 && (
            <ul className="mb-2 space-y-1.5">
              {photos.map((f, i) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-3 rounded-xl bg-white/70 border border-black/5 px-4 py-2.5"
                >
                  <span className="text-[11px] font-semibold text-[var(--brand-gray-light)] shrink-0 w-5">
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm text-[var(--brand-ink)]">
                    {f.name}
                  </span>
                  <span className="text-xs text-[var(--brand-gray-light)] shrink-0">
                    {formatBytes(f.size)}
                  </span>
                  {!busy && (
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="text-xs text-red-500 hover:text-red-600 shrink-0"
                    >
                      削除
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {photos.length < MAX_TOTAL_PHOTOS && (
            <button
              type="button"
              className={pickerButtonClass}
              disabled={busy}
              onClick={() => photosInputRef.current?.click()}
            >
              + 写真を追加({photos.length}/{MAX_TOTAL_PHOTOS})
            </button>
          )}
        </div>
      )}

      {/* v3.2: 左カラムの2行目(マイソクの下)にアスペクト比〜送信ボタン/
          注記までをまとめる。このwrapper自体はモバイルでは何も変えない
          (space-y-6は今までform全体にかかっていたのと同じ値をここで
          肩代わりするだけ)。 */}
      <div className="space-y-6 lg:col-start-1 lg:row-start-2">
      {/* アスペクト比 */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-2">
          動画のアスペクト比
        </label>
        <div className="space-y-2">
          {ASPECT_RATIOS.map((a) => (
            <label
              key={a}
              className="flex items-center gap-3 rounded-xl bg-white/60 border border-black/5 px-4 py-3 cursor-pointer hover:bg-white/85 transition-colors"
            >
              <input
                type="radio"
                name="aspect"
                checked={aspect === a}
                disabled={busy}
                onChange={() => setAspect(a)}
                className="accent-[var(--brand-orange)]"
              />
              <span className="text-sm text-[var(--brand-ink)]">
                {ASPECT_LABELS[a]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 取引種別 */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-2">
          取引種別
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DEAL_TYPES.map((d) => (
            <label
              key={d}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/60 border border-black/5 px-4 py-3 cursor-pointer hover:bg-white/85 transition-colors"
            >
              <input
                type="radio"
                name="deal"
                checked={deal === d}
                disabled={busy}
                onChange={() => setDeal(d)}
                className="accent-[var(--brand-orange)]"
              />
              <span className="text-sm text-[var(--brand-ink)]">
                {DEAL_LABELS[d]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* 魅力メモ(任意) */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
          この物件の魅力があれば、自由にお書きください(任意・箇条書きでも文章でもOK)
        </label>
        <p className="text-xs text-[var(--brand-gray-light)] mb-2">
          物件を実際にご存知の担当者ならではの一次情報をAIが台本づくりに活かします。家賃等の数値・条件はマイソクの記載が優先されます
        </p>
        <textarea
          value={appealNote}
          disabled={busy}
          onChange={(e) =>
            setAppealNote(e.target.value.slice(0, MAX_APPEAL_NOTE_LENGTH))
          }
          maxLength={MAX_APPEAL_NOTE_LENGTH}
          rows={5}
          placeholder={
            "例:\n・午後は陽当たりが良くリビングがとても明るい\n・向かいが公園で、窓からの景色と静かさが魅力\n・角部屋で風通しが良い"
          }
          className={`${inputClass} resize-y`}
        />
        <p className="mt-1 text-right text-[11px] text-[var(--brand-gray-light)]">
          {appealNote.length} / {MAX_APPEAL_NOTE_LENGTH}
        </p>
      </div>

      {/* 通知メール */}
      <div>
        <label className="block text-sm font-bold text-[var(--brand-ink)] mb-1">
          通知メールアドレス <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-[var(--brand-gray-light)] mb-2">
          完成動画の確認依頼・結果のご連絡をお送りします
        </p>
        <input
          type="email"
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mail@example.com"
          className={inputClass}
        />
      </div>

      {/* 進捗 */}
      {busy && (
        <div className="rounded-xl bg-white/70 border border-black/5 p-4 space-y-2">
          <div className="text-xs font-semibold text-[var(--brand-ink)]/70">
            {stepNote}
          </div>
          {uploads.map((u, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between gap-2 text-[var(--brand-gray)]">
                <span className="truncate">{u.label}</span>
                <span className="shrink-0">
                  {u.state === "done"
                    ? "完了"
                    : u.state === "error"
                      ? "失敗"
                      : u.state === "uploading"
                        ? `${u.pct}%`
                        : "待機中"}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    u.state === "error"
                      ? "bg-red-400"
                      : "bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)]"
                  }`}
                  style={{ width: `${u.state === "done" ? 100 : u.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-3.5 text-base hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {busy ? "送信中…(画面を閉じないでください)" : "この内容で動画作成を依頼する"}
      </button>
      <p className="text-center text-xs text-[var(--brand-ink)]/50">
        送信後、完成動画の確認依頼がメールで届きます(通常15〜30分)
      </p>
      </div>
    </form>
  );
}
