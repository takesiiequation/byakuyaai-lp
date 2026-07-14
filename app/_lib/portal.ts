import { google } from "googleapis";

// Client-portal dashboard data layer (/portal). Reads the "制作状況" tab of
// the SAME central spreadsheet as 承認待ち (GOOGLE_SHEET_ID) — see
// docs/property_db_f_design.md §P1.2. That tab is written by
// fudosan_v15-prod's `PortalStatus: Insert Received` node (n8n side, out of
// scope for this app) — this module only ever reads it.
//
// Absolute rule (design §P1.2 "重要な安全設計"): this module must NEVER read
// the 承認待ち tab directly — its `post_data` column carries a plaintext
// Publer API key. Detail lookups for a specific approval go through the
// existing sanitized getReviseInfo() relay (app/_lib/revise.ts) instead,
// which is deliberately not called from here (P1 dashboard shows only the
// coarse status list; "確認・修正する" links out to the existing
// /revise/[approvalId] page, which does its own getReviseInfo call).
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const PRODUCTION_TAB = process.env.GOOGLE_SHEET_PRODUCTION_TAB || "制作状況";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須

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

export interface ProductionRow {
  exec_id: string;
  client_id: string;
  client_name: string;
  property_name: string;
  status: string;
  approval_id: string;
  created_at: string;
  updated_at: string;
}

function rowToProduction(headers: string[], row: string[]): ProductionRow {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  return {
    exec_id: obj.exec_id ?? "",
    client_id: obj.client_id ?? "",
    client_name: obj.client_name ?? "",
    property_name: obj.property_name ?? "",
    status: obj.status ?? "",
    approval_id: obj.approval_id ?? "",
    created_at: obj.created_at ?? "",
    updated_at: obj.updated_at ?? "",
  };
}

/**
 * Reads `制作状況`, filtered to one client_id, newest-first. Fail-soft
 * (mirrors lineKnowledge.ts / getApprovalQueue): a not-yet-created tab, a
 * missing client_id column, or any Sheets API error all just yield [] so the
 * dashboard renders an empty-state instead of a 500 — this tab's rollout
 * (n8n side) can lag behind this app's deploy without breaking the page.
 */
export async function getProductionRows(
  clientId: string
): Promise<ProductionRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(PRODUCTION_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0] as string[];
    const idCol = headers.indexOf("client_id");
    if (idCol === -1) return [];

    return rows
      .slice(1)
      .filter((r) => (r as string[])[idCol] === clientId)
      .map((r) => rowToProduction(headers, r as string[]))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  } catch {
    return [];
  }
}

export type PortalStatus =
  | "processing"
  | "pending_approval"
  | "revising"
  | "posted"
  | "rejected"
  | "failed"
  | "revise_failed"
  | "unknown";

/**
 * Read-time status derivation (design §P1.2, TS移植 of the reference impl).
 * Unknown/empty/garbage status values all round down to "processing" rather
 * than being treated as done — never claim completion the pipeline hasn't
 * actually reported.
 *
 * "revising"(修正依頼中)は 2026-07-15 追加 — 差し戻しWF側がこの値を書く
 * 改修は別途進行中で、この時点ではシートにまだ現れない。フロントは先に
 * この値を認識できるようにしておくだけ(fail-soft: 来なければ従来通り
 * "processing" に丸め込まれるだけで壊れない)。
 *
 * "failed"/"revise_failed"(障害ステータス)も同様に先行追加 — 本体WF/差し
 * 戻しWF側でこれらの値を書く改修は別便(status_visibility_package_draft.md)。
 * n8n側が未着手の間はシートにこの値がまだ現れないだけで、フロントは
 * fail-soft に壊れず従来通り "processing" に丸め込まれる。
 */
export function resolveStatus(row: ProductionRow | null): PortalStatus {
  if (!row) return "unknown";
  const s = String(row.status || "").trim();
  if (
    s === "posted" ||
    s === "pending_approval" ||
    s === "rejected" ||
    s === "revising" ||
    s === "failed" ||
    s === "revise_failed"
  ) {
    return s;
  }
  return "processing";
}

export const PORTAL_STATUS_LABELS: Record<PortalStatus, string> = {
  processing: "制作中",
  pending_approval: "承認待ち",
  revising: "✏️ 修正中",
  posted: "投稿済み",
  rejected: "却下",
  failed: "⚠️ 生成に失敗しました",
  revise_failed: "⚠️ 修正に失敗しました",
  unknown: "不明",
};

export const PORTAL_STATUS_COLORS: Record<PortalStatus, string> = {
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  pending_approval: "bg-amber-50 text-amber-700 border-amber-200",
  revising: "bg-purple-50 text-purple-700 border-purple-200",
  posted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  failed: "bg-red-50 text-red-700 border-red-300",
  revise_failed: "bg-red-50 text-red-700 border-red-300",
  unknown: "bg-gray-100 text-gray-400 border-gray-200",
};

/**
 * Terminal (done, nothing left for the client to act on) vs. active
 * statuses. Used by the portal dashboard to keep every row that might need
 * a client action always on-screen while collapsing old finished rows —
 * see PortalPage's visible/hidden split. "unknown" deliberately counts as
 * active (not terminal): never hide a row we can't positively confirm is
 * done. "failed"/"revise_failed" are deliberately non-terminal too — they
 * are an action-needed state (再依頼/再送信待ち), not a done state; treating
 * them as terminal would let them get buried behind the 5-row collapse and
 * the client could miss a failure that needs a retry.
 */
export function isTerminalStatus(status: PortalStatus): boolean {
  return status === "posted" || status === "rejected";
}
