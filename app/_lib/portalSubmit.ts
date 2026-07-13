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
//    直下の exec_<uuid12>/{original,maisoku}。同じ場所に置くこと自体が
//    要件(夜間掃除cron・素材7日保持の回収対象がここだから)。
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

async function createFolder(name: string, parentId: string): Promise<string> {
  const res = await drive().files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
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
  const execFolderId = await createFolder(execId, rootFolderId());
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
 * これが仕様書(5)-①の自動assert「files.list が写真N枚を返すか」の実装
 * (n8n credential そのものではなく SA での近似だが、同一フォルダ・同一
 * クエリなので列挙結果の実在性は等価に検証できる)。 */
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

/** ログ/ドライラン応答用: secret_key を伏せたコピー(先頭4字+長さのみ)。
 * trim 済みか・空でないかの検証には足りる情報だけ残す。 */
export function maskPayload(p: SubmitPayload): Record<string, unknown> {
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
  | { sent: true; status: number };

/**
 * 実POSTを行う唯一の関数。フラグOFFなら fetch に一切到達しない
 * (仕様書(5)-①「webhook POSTの直前で停止」の実装)。URL は env のみ。
 * n8n は responseMode: onReceived のため 200 = 受理ではない(罠(4)-3)
 * — 呼び出し側はHTTPレベルの失敗だけをエラー扱いにする。
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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { sent: true, status: res.status };
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
