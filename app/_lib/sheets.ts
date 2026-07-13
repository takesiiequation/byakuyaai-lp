import { google } from "googleapis";
import type { Client } from "./types";
import { jstNow } from "./jst";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const TAB = process.env.GOOGLE_SHEET_TAB || "契約社リスト";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須
const APPROVAL_TAB = process.env.GOOGLE_SHEET_APPROVAL_TAB || "承認待ち";

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
    used_this_month: Number(obj.used_this_month) || 0,
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
    valueInputOption: "USER_ENTERED",
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
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
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
// Reads the SAME 承認待ち tab as getApprovalQueue above, filtered to one
// client_id + status==='approved' (= Publer への投稿が実際に成功した行、
// see fudosan-video/docs/archive/approval_handler_design.md 「B. 非同期
// publisher」— status=approved は投稿成功後だけ書かれる)。
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
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

/**
 * This month's (JST) approved+scheduled posts for one client. Fail-soft
 * (mirrors getApprovalQueue/getProductionRows): any Sheets error or
 * unparseable row is just skipped, never a 500.
 */
export async function getMonthlyApprovedSlots(
  clientId: string
): Promise<PostSlot[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(APPROVAL_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0] as string[];
    const { year: curYear, month: curMonth } = jstNow();

    const out: PostSlot[] = [];
    for (const r of rows.slice(1)) {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = (r as string[])[i] ?? "";
      });
      if (pickField(obj, ["client_id"]) !== clientId) continue;
      if (pickField(obj, ["status", "ステータス"]) !== "approved") continue;
      const slot = parseJstSlot(pickField(obj, ["my_post_slot"]));
      if (!slot || slot.year !== curYear || slot.month !== curMonth) continue;
      out.push({
        property_name: pickField(obj, ["物件名", "property_name", "property"]),
        day: slot.day,
        hour: slot.hour,
        minute: slot.minute,
      });
    }
    return out.sort(
      (a, b) => a.day - b.day || a.hour - b.hour || a.minute - b.minute
    );
  } catch {
    return [];
  }
}
