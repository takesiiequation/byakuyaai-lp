import { google } from "googleapis";
import type { Client } from "./types";
import { jstNow } from "./jst";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const TAB = process.env.GOOGLE_SHEET_TAB || "契約社リスト";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須
const APPROVAL_TAB = process.env.GOOGLE_SHEET_APPROVAL_TAB || "承認待ち";
// 掃除WFが完了行(approved/rejected等)を7日で退避する先。ヘッダは承認待ちと
// 同一+末尾に backup_at 列が増えるだけ(getMonthlyApprovedSlots はヘッダ名
// 駆動で読むので backup_at 列の有無自体は無視できる)。
const APPROVAL_BACKUP_TAB =
  process.env.GOOGLE_SHEET_APPROVAL_BACKUP_TAB || "承認待ち_backup";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function rowToClient(headers: string[], row: string[]): Client {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i] ?? "";
  }
  return {
    client_id: obj.client_id ?? "",
    secret_key: obj.secret_key ?? "",
    client_name: obj.client_name ?? "",
    plan: obj.plan ?? "",
    tone: obj.tone ?? "",
    monthly_quota: Number(obj.monthly_quota) || 0,
    // 管理者の手入力ミス(負値)でも残数バッジが過大表示にならないよう下限0
    // クランプ。quota.ts の effectiveUsed/quotaSummary は client.used_this_month
    // をそのまま使う比較式なので(n8n本体ミラー・式は変更しない)、ここで数値化
    // 時点から負値を消しておく。monthly_quota は quota.ts 側で quota<=0 を
    // 「未設定」として扱う(QuotaBadge)ため、負値でも既に安全に丸め込まれている。
    used_this_month: Math.max(0, Number(obj.used_this_month) || 0),
    quota_reset: obj.quota_reset ?? "",
    publer_ig_account_id: obj.publer_ig_account_id ?? "",
    publer_tt_account_id: obj.publer_tt_account_id ?? "",
    notify_email: obj.notify_email ?? "",
    status: obj.status ?? "",
    next_post_slot: obj.next_post_slot ?? "",
    require_approval: obj.require_approval ?? "",
    approval_email: obj.approval_email ?? "",
    line_channel_token: obj.line_channel_token ?? "",
    line_channel_secret: obj.line_channel_secret ?? "",
    line_bot_user_id: obj.line_bot_user_id ?? "",
    line_data_sheet_id: obj.line_data_sheet_id ?? "",
    link_hp_url: obj.link_hp_url ?? "",
    link_line_url: obj.link_line_url ?? "",
    drive_folder_id: obj.drive_folder_id ?? "",
    portal_password: obj.portal_password ?? "",
    portal_enabled: obj.portal_enabled ?? "",
    license_number: obj.license_number ?? "",
    transaction_type_default: obj.transaction_type_default ?? "",
    portfolio_slug: obj.portfolio_slug ?? "",
    portfolio_enabled: obj.portfolio_enabled ?? "",
    line_staff_user_ids: obj.line_staff_user_ids ?? "",
    report_enabled: obj.report_enabled ?? "",
    invoice_enabled: obj.invoice_enabled ?? "",
    line_notify_email: obj.line_notify_email ?? "",
  };
}

export async function getAllClients(): Promise<Client[]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(TAB),
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];
  const headers = rows[0] as string[];
  return rows.slice(1).map((r) => rowToClient(headers, r as string[]));
}

export async function getClientById(
  clientId: string
): Promise<Client | null> {
  const all = await getAllClients();
  return all.find((c) => c.client_id === clientId) ?? null;
}

export async function updateClient(
  clientId: string,
  data: Partial<Client>
): Promise<void> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(TAB),
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error("Sheet is empty");

  const headers = rows[0] as string[];
  const idCol = headers.indexOf("client_id");
  if (idCol === -1) throw new Error("client_id column not found");

  const rowIdx = rows.findIndex(
    (r, i) => i > 0 && (r as string[])[idCol] === clientId
  );
  if (rowIdx === -1) throw new Error(`Client ${clientId} not found`);

  const existing = rows[rowIdx] as string[];
  for (const [key, value] of Object.entries(data)) {
    const col = headers.indexOf(key);
    if (col === -1) continue;
    while (existing.length <= col) existing.push("");
    existing[col] = String(value ?? "");
  }

  const rowNum = rowIdx + 1;
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${qt(TAB)}!A${rowNum}`,
    // 2026-08-07: RAW必須。USER_ENTERED だと Sheets が "true" を boolean TRUE に
    // 昇格させ、読み戻しが "TRUE" になってフラグ判定をすり抜ける(小濱様の
    // ポータルログイン不能事故)。portal.ts の hideProductionRow と同じ流儀。
    valueInputOption: "RAW",
    requestBody: { values: [existing] },
  });
}

export async function addClient(data: Client): Promise<void> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${qt(TAB)}!A1:1`,
  });
  const headers = (res.data.values?.[0] as string[]) ?? [];
  if (!headers.length) throw new Error("No headers in sheet");

  const row = headers.map((h) => {
    const val = (data as unknown as Record<string, unknown>)[h];
    return val != null ? String(val) : "";
  });

  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(TAB)}!A:A`,
    // 2026-08-07: RAW必須。USER_ENTERED だと Sheets が "true" を boolean TRUE に
    // 昇格させ、読み戻しが "TRUE" になってフラグ判定をすり抜ける(小濱様の
    // ポータルログイン不能事故)。portal.ts の hideProductionRow と同じ流儀。
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

// --- Portal: 顧客フィードバック ------------------------------------------
// 2026-07-22 岡本発案: ポータルから気軽に意見・要望・不満を送れる画面
// (app/portal/feedback)。目的は①不満の早期検知(解約前に拾う)②好評の声の
// 収集(営業・LP転用の証言資産)。専用タブなので addClient のようなヘッダー
// 駆動マッピングは不要 — 列順を固定してそのまま追記する
// (recorded_at, client_id, score, category, body, page)。
const FEEDBACK_TAB = process.env.GOOGLE_SHEET_FEEDBACK_TAB || "フィードバック";

export interface FeedbackEntry {
  recorded_at: string;
  client_id: string;
  score: number;
  category: string;
  body: string;
  page: string;
}

/** 呼び出し側(app/api/portal/feedback/route.ts)が fail-soft でキャッチする
 * 前提で、ここでは素直に throw する(シートが存在しない/権限不足等)。 */
export async function appendFeedback(entry: FeedbackEntry): Promise<void> {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(FEEDBACK_TAB)}!A:A`,
    // 2026-08-07: RAW必須。USER_ENTERED だと Sheets が "true" を boolean TRUE に
    // 昇格させ、読み戻しが "TRUE" になってフラグ判定をすり抜ける(小濱様の
    // ポータルログイン不能事故)。portal.ts の hideProductionRow と同じ流儀。
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          entry.recorded_at,
          entry.client_id,
          String(entry.score),
          entry.category,
          entry.body,
          entry.page,
        ],
      ],
    },
  });
}

// --- Module C: 承認待ち / 直近の生成履歴 --------------------------------
// The real headers of this tab are unconfirmed from code, so this reader is
// intentionally defensive: generic header-driven parsing (no assumed column
// order), a handful of accepted header-name variants per logical field, and
// try/catch → [] on any failure (mirrors billing.ts's pattern) so a wrong or
// missing tab name never breaks the dashboard build/render.
export interface ApprovalEntry {
  approval_id: string;
  client_id: string;
  client_name: string;
  property_name: string;
  status: string;
  created_at: string;
}

function pickField(obj: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (obj[k]) return obj[k];
  }
  return "";
}

export async function getApprovalQueue(): Promise<ApprovalEntry[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(APPROVAL_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0] as string[];
    return rows.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r as string[])[i] ?? "";
      });
      return {
        approval_id: pickField(obj, ["approval_id", "id"]),
        client_id: pickField(obj, ["client_id"]),
        client_name: pickField(obj, ["client_name", "company_name", "顧客名"]),
        property_name: pickField(obj, ["物件名", "property_name", "property"]),
        status: pickField(obj, ["status", "ステータス"]),
        created_at: pickField(obj, ["created_at", "作成日時", "ts", "timestamp"]),
      };
    });
  } catch {
    return [];
  }
}

// --- Portal: 今月の投稿カレンダー ---------------------------------------
// Reads 承認待ち(現行分)+ 承認待ち_backup(掃除WFが7日で退避した完了分)
// の2タブを、1 client_id 分だけ拾って統合する。
//
// 2026-07-27 判定ロジック見直し: 旧実装は status==='approved' 行だけを
// 拾っていたが、実運用ではその条件がほぼ常に成立しない――
//  ① 修正ロック解除(承認後の差し戻し等)で status が pending に戻った
//     投稿済み行がある(status_visibility_package_draft.md 系の改修で
//     approved が別値に上書きされるケース)
//  ② 掃除WFが完了行(approved/rejected等)を7日で 承認待ち_backup タブへ
//     移すため、承認から7日経った行はそもそも 承認待ち タブに残らない
// のどちらか(あるいは両方)で、カレンダーが常に空になっていた
// (「カレンダー機能してない」の真因)。my_post_slot が実際にパースできる
// = Publer への投稿が(過去に)予約/実行されたことを意味するので、
// rejected(却下されて投稿されなかった)行だけを除外し、それ以外は
// slotがある限り拾う。
//
// 🚨 Absolute rule (mirrors portal.ts's comment on this same tab): this tab's
// post_data column carries a plaintext Publer API key. This function NEVER
// spreads/returns the raw row — only the 4 named fields below are ever
// picked out, so a future column added to 承認待ち can't leak through here
// by accident.
export interface PostSlot {
  property_name: string;
  /** JST calendar day-of-month (1-31). */
  day: number;
  hour: number;
  minute: number;
}

// my_post_slot is written by n8n as an explicit-offset JST string, e.g.
// "2026-07-15T19:00:00+09:00" (scripts/build_approval_handler.py's
// jstIso(): dt.getFullYear()+'-'+...+'T'+...+'+09:00', where dt's
// getters already read out JST wall-clock values). Read the leading digits
// directly with a regex instead of `new Date(...)` — the digits already ARE
// JST wall-clock time, so running them through Date/toLocaleString would
// risk a double timezone shift (and Sheets may hand back a slightly
// different textual format than what was written, e.g. no seconds, a space
// instead of "T", or "/" instead of "-" if a cell got auto-formatted as a
// date by Sheets — this regex accepts all of those).
function parseJstSlot(
  raw: string
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const m = (raw || "").trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  // 手入力ミス等でレンジ外の数値(月13・時25等)が来ても、モバイル一覧/月
  // グリッドの表示崩れを防ぐため null を返し、呼び出し側の既存 fail-soft
  // (「!slot なら skip」)にそのまま乗せてカレンダーから除外する。
  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) {
    return null;
  }
  return {
    year: Number(m[1]),
    month,
    day,
    hour,
    minute,
  };
}

/** extractSlotsFromRows の戻り値。dedupKey は「approval_id + 生のmy_post_slot
 * 文字列」— 承認待ち/承認待ち_backup 両タブに同じ行が(掃除WFのコピー→削除
 * 実装が完了する前の一瞬など)重複して存在するケースを潰すためだけの内部キー
 * で、PostSlot自体(呼び出し側に返す形)には含めない。 */
interface DedupSlot {
  dedupKey: string;
  slot: PostSlot;
}

// 1タブ分の rows(ヘッダ込み)から、月次カレンダーに載せてよい PostSlot を
// 抜き出す共通ロジック。承認待ち/承認待ち_backup はヘッダが同一(backupは
// 末尾に backup_at 列が増えるだけ)なので、この関数を両タブに使い回せる。
// rejected(却下されて投稿されなかった)行だけを除外し、my_post_slot が
// パースでき、かつ今月(JST)の行だけを拾う——詳しい理由は
// getMonthlyApprovedSlots 直前のコメント参照。
function extractSlotsFromRows(
  rows: string[][] | null | undefined,
  clientId: string,
  curYear: number,
  curMonth: number
): DedupSlot[] {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0] as string[];
  const out: DedupSlot[] = [];
  for (const r of rows.slice(1)) {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r as string[])[i] ?? "";
    });
    if (pickField(obj, ["client_id"]) !== clientId) continue;
    if (pickField(obj, ["status", "ステータス"]) === "rejected") continue;
    const rawSlot = pickField(obj, ["my_post_slot"]);
    const slot = parseJstSlot(rawSlot);
    if (!slot || slot.year !== curYear || slot.month !== curMonth) continue;
    const approvalId = pickField(obj, ["approval_id", "id"]);
    out.push({
      dedupKey: `${approvalId}|${rawSlot}`,
      slot: {
        property_name: pickField(obj, ["物件名", "property_name", "property"]),
        day: slot.day,
        hour: slot.hour,
        minute: slot.minute,
      },
    });
  }
  return out;
}

/**
 * This month's (JST) scheduled/posted slots for one client, merged from
 * 承認待ち + 承認待ち_backup. Fail-soft (mirrors getApprovalQueue/
 * getProductionRows): any Sheets error (either tab missing/unreadable) or
 * unparseable row is just skipped, never a 500 — 承認待ち_backup 特有の
 * 「タブがまだ存在しない」ケースも同じ fail-soft で無視する。
 */
export async function getMonthlyApprovedSlots(
  clientId: string
): Promise<PostSlot[]> {
  const { year: curYear, month: curMonth } = jstNow();

  // 現行タブ・backupタブは別々に fail-soft(片方が読めなくてももう片方は
  // 生かす)。
  let liveRows: string[][] | null | undefined;
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(APPROVAL_TAB),
    });
    liveRows = res.data.values as string[][] | null | undefined;
  } catch {
    liveRows = null;
  }

  let backupRows: string[][] | null | undefined;
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(APPROVAL_BACKUP_TAB),
    });
    backupRows = res.data.values as string[][] | null | undefined;
  } catch {
    backupRows = null;
  }

  const combined = [
    ...extractSlotsFromRows(liveRows, clientId, curYear, curMonth),
    ...extractSlotsFromRows(backupRows, clientId, curYear, curMonth),
  ];

  // approval_id + my_post_slot の組で重複除去。
  const seen = new Set<string>();
  const out: PostSlot[] = [];
  for (const item of combined) {
    if (seen.has(item.dedupKey)) continue;
    seen.add(item.dedupKey);
    out.push(item.slot);
  }

  return out.sort(
    (a, b) => a.day - b.day || a.hour - b.hour || a.minute - b.minute
  );
}
