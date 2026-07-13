import { google } from "googleapis";
import { createHmac, randomUUID } from "crypto";
import type { Client } from "./types";
import { effectiveUsed } from "./quota";
import {
  ASPECT_RATIOS,
  DEAL_TYPES,
  MAX_PHOTOS,
  type AspectRatio,
  type DealType,
} from "./portalSubmitShared";

// ============================================================
// /portal/submit のサーバー側データ層 — Googleフォーム卒業の入口。
//
// 正本仕様: 「ポータル送信API 仕様書(突合確定版)」+ GAS正本
// (fudosan-video/docs/forms_v15/standard_form.gs)。ペイロードは
// GAS互換13フィールドを厳密に再現する = n8n(fudosan_v15-prod)側の
// 改修ゼロで通る設計。
//
// 🚨 送信ゲート(構造的安全装置): 本番 n8n webhook への実POSTは
// PORTAL_SUBMIT_ENABLED === "true" のときだけ dispatchSubmit() が行う。
// webhook URL は PORTAL_SUBMIT_WEBHOOK_URL(env)のみ — コードのどこにも
// ハードコードしない。両方が揃わない限り、このモジュールから外部へ
// 出ていくPOSTはゼロ(ドライラン=仕様書(5)-①の送信ゲート方式)。
//
// Drive まわりの前提(仕様書(3)):
//  - 保存先は GAS と同一の CLIENT_ROOT(env PORTAL_SUBMIT_ROOT_FOLDER_ID)
//    直下の exec_<uuid12>/{original,maisoku}。GAS標準フォームの成果物と
//    同じ場所に置くことが要件。
//    ⚠️ 夜間掃除cron(NM1RFQy45acrWQEP)は CLIENT_ROOT 直下の
//    vo_/clip_/revision_manifest プレフィックスのみが対象で、exec_
//    フォルダには一切触れない — 送信が中断された exec_ は「7日保持で
//    自動回収」されず孤児のまま残る(TODO(実弾後ハードニング): exec_
//    専用のGC枝を掃除cronに追加する。あわせて createExecFolders が
//    3フォルダ作成の途中で失敗した場合のbest-effortロールバックも
//    未実装 — 半端なexec_フォルダが残り得る)。
//  - アップロードは SA(GOOGLE_SERVICE_ACCOUNT_KEY)による resumable
//    upload session 発行 → ブラウザ直PUT(Vercel 4.5MB制限回避)。
//    SA方式の既知の注意(SAクォータ消費・AUTH FAIL cleanupのtrash 403
//    可能性)は仕様書(3)に記載 — ドライラン②(無効鍵実弾)で実測する。
// ============================================================

const UPLOAD_SESSION_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true";

function rootFolderId(): string {
  const id = process.env.PORTAL_SUBMIT_ROOT_FOLDER_ID;
  if (!id) {
    throw new Error(
      "PORTAL_SUBMIT_ROOT_FOLDER_ID is not set — GAS標準フォームの CLIENT_ROOT_FOLDER_ID と同じIDを設定すること"
    );
  }
  return id;
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function drive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

// ------------------------------------------------------------
// exec バンドル(署名付きトークン)
// init が Drive にフォルダを実作成して発行し、以降の upload-url / submit は
// トークンの HMAC 検証だけでフォルダの正当性を確認する(ステートレス)。
// これが無いと、認証済み顧客が任意の folder_id を渡して SA が書ける
// 別テナントのフォルダへアップロードできてしまう(クロステナント防止)。
// 署名鍵は PORTAL_SESSION_SECRET を共用(同一信頼ドメイン・fail-closed)。
// ------------------------------------------------------------

export interface ExecBundle {
  client_id: string;
  exec_id: string;
  exec_folder_id: string;
  original_folder_id: string;
  maisoku_folder_id: string;
  issued_at: number; // epoch ms
}

const BUNDLE_TTL_MS = 2 * 60 * 60 * 1000; // 2時間(アップロード作業の余裕)
// TODO(実弾後ハードニング): 大容量/低速回線で2時間を超えるケースのため
// 6-8hへ延長を検討。「セッション切れ」と「純粋な時間超過」で顧客向け
// 文言を出し分ける。本命はupload-urlのローリング再発行(トークンの
// 都度更新)で、TTL延長は次善策。

// TODO(実弾後ハードニング): PORTAL_SESSION_SECRET はここ(execバンドル
// 署名)と portalAuth.ts(ポータルセッションcookie署名)の2用途で同一の
// 鍵を共用している。片方が漏洩すればもう片方も偽造可能になるため、
// context prefix(例: "bundle:"/"session:")で署名ドメインを分離する。
function secret(): string {
  const s = process.env.PORTAL_SESSION_SECRET;
  if (!s) {
    throw new Error(
      "PORTAL_SESSION_SECRET is not set — refusing to sign/verify submit tokens"
    );
  }
  return s;
}

function signBundle(json: string): string {
  return createHmac("sha256", secret()).update(json).digest("hex");
}

export function encodeBundle(bundle: ExecBundle): string {
  const json = JSON.stringify(bundle);
  const b64 = Buffer.from(json, "utf-8").toString("base64url");
  return `${b64}.${signBundle(json)}`;
}

/** 改ざん/期限切れ/署名鍵未設定はすべて null(fail-closed・throwしない)。 */
export function decodeBundle(token: string): ExecBundle | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const b64 = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const json = Buffer.from(b64, "base64url").toString("utf-8");
    // TODO(実弾後ハードニング): 文字列 !== 比較はタイミング攻撃に理論上
    // 弱い(crypto.timingSafeEqualへの置換候補・portalAuth.ts:60の同型
    // 比較とセットで直す)。BUNDLE_TTL_MS内に exec_id を推測しつつ大量
    // 試行する必要があり実害は低いが、直すコスト自体は低い。
    if (!sig || signBundle(json) !== sig) return null;
    const bundle = JSON.parse(json) as ExecBundle;
    if (
      !bundle ||
      typeof bundle.client_id !== "string" ||
      typeof bundle.exec_id !== "string" ||
      typeof bundle.exec_folder_id !== "string" ||
      typeof bundle.original_folder_id !== "string" ||
      typeof bundle.maisoku_folder_id !== "string" ||
      typeof bundle.issued_at !== "number"
    ) {
      return null;
    }
    if (Date.now() - bundle.issued_at > BUNDLE_TTL_MS) return null;
    return bundle;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Drive: exec フォルダ作成(GAS createExecFolder と同型)
// ------------------------------------------------------------

/** GAS慣習: exec_ + UUID(ハイフン除去)先頭12桁。n8n自体は未使用だが
 * フォルダ名と揃える(仕様書(2) exec_id)。 */
export function generateExecId(): string {
  return "exec_" + randomUUID().replace(/-/g, "").slice(0, 12);
}

// TODO(実弾後ハードニング): createFolder(POST)は生のAPI呼び出しで
// リトライ/バックオフが無い — Drive側の一時的な5xx/429で即失敗する。
async function createFolder(
  name: string,
  parentId: string,
  appProperties?: Record<string, string>
): Promise<string> {
  const res = await drive().files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
      ...(appProperties ? { appProperties } : {}),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error("Drive did not return a folder id");
  return id;
}

export async function createExecFolders(clientId: string): Promise<ExecBundle> {
  const execId = generateExecId();
  // client_id を exec フォルダの appProperties に刻む — FIX-3a(未dispatch
  // なexec_フォルダ数のclient別カウント)の基礎になる。
  // TODO(実弾後ハードニング): 3フォルダ作成の途中(2/3個目)でDrive API
  // が失敗すると先に作った分だけが孤児として残る。catchしてbest-effort
  // でロールバック(直前に作った分をtrash)する。
  const execFolderId = await createFolder(execId, rootFolderId(), {
    client_id: clientId,
  });
  const originalFolderId = await createFolder("original", execFolderId);
  const maisokuFolderId = await createFolder("maisoku", execFolderId);
  return {
    client_id: clientId,
    exec_id: execId,
    exec_folder_id: execFolderId,
    original_folder_id: originalFolderId,
    maisoku_folder_id: maisokuFolderId,
    issued_at: Date.now(),
  };
}

// ------------------------------------------------------------
// Drive: resumable upload session(ブラウザ直PUT用)
// ------------------------------------------------------------

/**
 * resumable session を発行して session URL を返す。ブラウザからの PUT を
 * CORS で通すために、セッション開始リクエストへ Origin ヘッダを付ける
 * (Google はこの Origin を以降の PUT の許可オリジンにする)。
 *
 * TODO(実弾後ハードニング): 生fetchでリトライ/バックオフが無い —
 * Drive側の一時的な5xx/429やトークン取得失敗で即エラーになる。
 */
export async function createResumableUploadUrl(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
  origin: string | null;
}): Promise<string> {
  const token = await getAuth().getAccessToken();
  if (!token) throw new Error("Failed to obtain Drive access token");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": opts.mimeType,
    "X-Upload-Content-Length": String(opts.size),
  };
  if (opts.origin) headers["Origin"] = opts.origin;

  const res = await fetch(UPLOAD_SESSION_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: opts.name, parents: [opts.folderId] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Drive resumable session failed: HTTP ${res.status} ${body.slice(0, 300)}`
    );
  }
  const location = res.headers.get("location");
  if (!location) throw new Error("Drive did not return an upload session URL");
  return location;
}

// ------------------------------------------------------------
// Drive: フォルダ内ファイル列挙(送信前の実在検証)
// ------------------------------------------------------------

export interface DriveFileLite {
  id: string;
  name: string;
  mimeType: string;
}

async function listFolder(folderId: string, q: string): Promise<DriveFileLite[]> {
  const res = await drive().files.list({
    q,
    fields: "files(id, name, mimeType)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
  }));
}

/** n8n「List Photos from Folder - NoStaging」と同一クエリでの写真列挙。
 * ⚠️ /portal/submit の実在検証本線からは FIX-1 で外れた(files.list は
 * 書き込み直後のインデックスラグを受け、正常な送信を409で誤拒否する
 * 事故があった → getFileMeta による個別強整合確認に置換済み)。ここでは
 * 汎用の列挙ユーティリティとして残す(FIX-3の濫用キャップ等が使用)。 */
export function listFolderImages(folderId: string): Promise<DriveFileLite[]> {
  return listFolder(
    folderId,
    `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`
  );
}

export function listFolderFiles(folderId: string): Promise<DriveFileLite[]> {
  return listFolder(folderId, `'${folderId}' in parents and trashed=false`);
}

// ------------------------------------------------------------
// Drive: 個別ファイルの強整合確認(FIX-1)
// ------------------------------------------------------------

export interface FileMeta {
  id: string;
  parents: string[];
  trashed: boolean;
  mimeType: string;
}

/** FIX-1【最優先】: files.list は書き込み直後のインデックス反映に
 * ラグがあり得るため、PUT直後の submit で claim された file_id を
 * files.list の列挙結果と突合すると、正当な送信が稀に409で誤拒否
 * される(list result consistency lag)。files.get はID参照で読むため
 * このラグを受けない — claim された各 file_id をこれで個別に強整合
 * 確認する方式に変更した。存在しない/権限エラー等は null を返す
 * (fail-closed: 呼び出し側は「未検証」として拒否側に倒す)。 */
export async function getFileMeta(fileId: string): Promise<FileMeta | null> {
  try {
    const res = await drive().files.get({
      fileId,
      fields: "id, parents, trashed, mimeType",
      supportsAllDrives: true,
    });
    const id = res.data.id;
    if (!id) return null;
    return {
      id,
      parents: res.data.parents ?? [],
      trashed: res.data.trashed ?? false,
      mimeType: res.data.mimeType ?? "",
    };
  } catch (e) {
    console.error(`[portalSubmit] getFileMeta(${fileId}) failed:`, e);
    return null;
  }
}

// ------------------------------------------------------------
// Drive クエリ文字列のリテラルエスケープ(' はDrive API仕様通り \' )
// ------------------------------------------------------------

function escapeQueryValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ------------------------------------------------------------
// ペイロード(仕様書(2) 全13フィールド・GAS正本互換)
// ------------------------------------------------------------

export interface SubmitPayload {
  test_bypass: boolean; // 常に boolean の false(罠(4)-1: 文字列"false"禁止)
  email: string;
  secret_key: string;
  maisoku_file_id: string;
  staging_file_ids: string; // 常に ""(モードスイッチ・罠(4)-2)
  nostaging_file_ids: string;
  aspect_ratio: AspectRatio;
  deal_type: DealType;
  exec_id: string;
  exec_folder_id: string;
  staging_folder_id: string; // 常に ""
  nostaging_folder_id: string;
  maisoku_folder_id: string;
}

export function buildSubmitPayload(opts: {
  bundle: ExecBundle;
  client: Client;
  email: string;
  maisokuFileId: string;
  photoFileIds: string[];
  aspectRatio: AspectRatio;
  dealType: DealType;
}): SubmitPayload {
  return {
    test_bypass: false,
    email: opts.email.trim(),
    secret_key: (opts.client.secret_key || "").trim(),
    maisoku_file_id: opts.maisokuFileId,
    staging_file_ids: "",
    nostaging_file_ids: opts.photoFileIds.join(","),
    aspect_ratio: opts.aspectRatio,
    deal_type: opts.dealType,
    exec_id: opts.bundle.exec_id,
    exec_folder_id: opts.bundle.exec_folder_id,
    staging_folder_id: "",
    nostaging_folder_id: opts.bundle.original_folder_id,
    maisoku_folder_id: opts.bundle.maisoku_folder_id,
  };
}

/** 仕様書(5)-①の自動assert群。違反リストを返す(空=合格)。
 * ここで弾かれるのは実装バグであって顧客入力ミスではない — 呼び出し側は
 * 500 にする。実POST直前とドライランの両方で必ず通す。 */
export function payloadViolations(p: SubmitPayload): string[] {
  const v: string[] = [];
  if (p.staging_file_ids !== "") v.push("staging_file_ids must be ''");
  if (p.staging_folder_id !== "") v.push("staging_folder_id must be ''");
  if (typeof p.test_bypass !== "boolean" || p.test_bypass !== false) {
    v.push("test_bypass must be boolean false");
  }
  if (!p.secret_key) v.push("secret_key is empty");
  if (!p.email) v.push("email is empty (顧客通知が全て消える)");
  if (!p.maisoku_file_id) v.push("maisoku_file_id is empty (物件情報が全空で静かに進む事故)");
  if (!p.nostaging_folder_id) v.push("nostaging_folder_id is empty (写真0枚throw即死)");
  if (!p.nostaging_file_ids) v.push("nostaging_file_ids is empty");
  const ids = p.nostaging_file_ids.split(",").filter(Boolean);
  if (ids.length < 1 || ids.length > MAX_PHOTOS) {
    v.push(`nostaging_file_ids count out of range: ${ids.length}`);
  }
  if (!(ASPECT_RATIOS as readonly string[]).includes(p.aspect_ratio)) {
    v.push(`aspect_ratio invalid: ${p.aspect_ratio}`);
  }
  if (!(DEAL_TYPES as readonly string[]).includes(p.deal_type)) {
    v.push(`deal_type invalid: ${p.deal_type}`);
  }
  if (!p.exec_folder_id) v.push("exec_folder_id is empty (VOがフォルダ外に散る)");
  return v;
}

/** FIX-4: レスポンス/ブラウザ向け。secret_key を "(set)"/"(EMPTY)" に
 * 完全縮退する — 「鍵はブラウザに一切来ない」不変条件をここで担保する。
 * API応答・ドライラン表示など、サーバー外に出る可能性がある出力は
 * 必ずこちらを使うこと(先頭4字+桁長のデバッグ表示が欲しい場合は
 * debugMaskPayload を console.error 限定で使う)。 */
export function maskPayload(p: SubmitPayload): Record<string, unknown> {
  return {
    ...p,
    secret_key: p.secret_key ? "(set)" : "(EMPTY)",
  };
}

/** サーバーログ専用(console.error 限定・レスポンスやブラウザには絶対に
 * 渡さないこと): secret_key の先頭4字+長さのみ残した調査用マスク。
 * trim 済みか・空でないかの切り分けに使う。 */
export function debugMaskPayload(p: SubmitPayload): Record<string, unknown> {
  return {
    ...p,
    secret_key: p.secret_key
      ? `${p.secret_key.slice(0, 4)}***(len=${p.secret_key.length})`
      : "(EMPTY)",
  };
}

// ------------------------------------------------------------
// 送信ゲート(実POSTはここだけ・二重ゲート)
// ------------------------------------------------------------

export function isSubmitEnabled(): boolean {
  return process.env.PORTAL_SUBMIT_ENABLED === "true";
}

export type DispatchResult =
  | { sent: false; reason: "disabled" }
  | { sent: false; reason: "already_dispatched" }
  | { sent: true; status: number };

const DISPATCH_MARKER_NAME = ".dispatched";

/** FIX-2: exec フォルダ直下に冪等性マーカーがあるか確認する。
 * decodeBundle は署名+TTLのみでnonceが無いため、同一トークンでの
 * submit再送(ブラウザの多重クリック・ネットワーク再送・悪意ある
 * リプレイ)を防げない — この「送信済み」状態がサーバー側で唯一の
 * 防波堤になる。根治(n8n側でexec_idをキーにした冪等化)は将来課題。 */
export async function isDispatched(execFolderId: string): Promise<boolean> {
  const markers = await listFolder(
    execFolderId,
    `'${execFolderId}' in parents and trashed=false and name='${DISPATCH_MARKER_NAME}'`
  );
  return markers.length > 0;
}

/** best-effort: マーカー作成に失敗しても dispatch 自体は止めない
 * (冪等性が完璧でなくても、無いよりは大幅にマシ)。 */
async function createDispatchMarker(execFolderId: string): Promise<void> {
  await drive().files.create({
    requestBody: {
      name: DISPATCH_MARKER_NAME,
      mimeType: "text/plain",
      parents: [execFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
}

/**
 * 実POSTを行う唯一の関数。フラグOFFなら fetch に一切到達しない
 * (仕様書(5)-①「webhook POSTの直前で停止」の実装)。URL は env のみ。
 * n8n は responseMode: onReceived のため 200 = 受理ではない(罠(4)-3)
 * — 呼び出し側はHTTPレベルの失敗だけをエラー扱いにする。
 *
 * FIX-2: dispatch直前に exec フォルダの .dispatched マーカーを確認し、
 * 既にあれば送らない(二重生成・クォータ二重消費の防止)。マーカー
 * 作成→dispatch の順で、マーカー作成はbest-effort。確認と作成の間に
 * 同時リクエストが割り込むわずかなTOCTOUの窓は残るが、nonce無し
 * トークンに対する現実的な防波堤としてこれを採用する。
 */
export async function dispatchSubmit(payload: SubmitPayload): Promise<DispatchResult> {
  if (!isSubmitEnabled()) {
    return { sent: false, reason: "disabled" };
  }
  const url = process.env.PORTAL_SUBMIT_WEBHOOK_URL;
  if (!url) {
    throw new Error(
      "PORTAL_SUBMIT_ENABLED=true なのに PORTAL_SUBMIT_WEBHOOK_URL が未設定"
    );
  }
  const violations = payloadViolations(payload);
  if (violations.length > 0) {
    throw new Error(`payload invariant violation: ${violations.join(" / ")}`);
  }

  if (await isDispatched(payload.exec_folder_id)) {
    return { sent: false, reason: "already_dispatched" };
  }
  try {
    await createDispatchMarker(payload.exec_folder_id);
  } catch (e) {
    console.error(
      "[portalSubmit] dispatch marker creation failed (best-effort, continuing):",
      e
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { sent: true, status: res.status };
}

// ------------------------------------------------------------
// FIX-3a: 未dispatchなexec_フォルダ数の最小濫用キャップ(KV不要)
// ------------------------------------------------------------

/** ある client が同時に持てる「未送信(未dispatch)のexec_フォルダ」の
 * 上限。init はこれを超えると新規発行を拒否する。本格的なレート制限
 * (Vercel KV/Upstash等)は実弾後ハードニング課題 — これはDrive列挙
 * ベースの最小防御。 */
export const MAX_ACTIVE_EXEC_PER_CLIENT = 5;

export async function countUndispatchedExecFolders(clientId: string): Promise<number> {
  const root = rootFolderId();
  const folders = await listFolder(
    root,
    `'${root}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='client_id' and value='${escapeQueryValue(clientId)}' }`
  );
  const dispatchedFlags = await Promise.all(folders.map((f) => isDispatched(f.id)));
  return dispatchedFlags.filter((dispatched) => !dispatched).length;
}

// ------------------------------------------------------------
// クォータ事前チェック(罠(4)-5: 連打・上限超過のUI側抑止)
// n8n が正本(受理時+1・月初自動リセット)— ここはUX用の事前判定のみ。
// 実際の reset-aware な使用数計算は quota.ts に一本化(ダッシュボードの
// 残数バッジと必ず同じ結論になるように — 2026-07-13統一、旧 isPastMonth
// は (year, month) バケット比較で quota_reset の「日」を無視しており、
// n8n の todayJst >= quotaReset という日単位比較とズレることがあった)。
// ------------------------------------------------------------

export type QuotaState = "ok" | "not_configured" | "exceeded";

export function quotaState(client: Client): QuotaState {
  const quota = client.monthly_quota;
  if (!quota || quota <= 0) return "not_configured"; // n8n側は quota_not_configured 拒否
  const used = effectiveUsed(client);
  return used >= quota ? "exceeded" : "ok";
}
