import { google } from "googleapis";

// Property DB data layer (the "物件" tab inside each client's own
// line_data_sheet_id spreadsheet — same per-client-spreadsheet pattern as
// lineKnowledge.ts, NOT the central GOOGLE_SHEET_ID). See
// docs/property_db_f_design.md §1-§2 for the full spec.
//
// This module owns the ONE canonical TS implementation of
// normalizePropertyName/propertyKey and isPropertyVisible (§2.1's 3-guard).
// The /f page, PropertyJsonLd, and (later) the LINE `AI Reply` TS port all
// must import from here rather than re-deriving visibility — design §6
// lists 7 required copies of this logic across the whole system; this file
// is copy ⑥ (Next.js) and the "唯一の実体" for everything under app/f.
// If you change the 3-guard logic here, the other 6 copies (n8n Code nodes)
// must be changed in the same sitting — see §6's table.

const TAB = () => process.env.PROPERTY_TAB || "物件";
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

// --- §1.2 normalizePropertyName / propertyKey ------------------------------
// Byte-identical port of the design doc's reference JS (§1.2). Do not
// "clean up" the regex/order here without updating the other copies listed
// in design §6.
export function normalizePropertyName(raw: string | null | undefined): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/[\s　]+/g, "")
    .trim();
}

export function propertyKey(clientId: string, propertyName: string): string {
  return `${String(clientId)}::${normalizePropertyName(propertyName)}`;
}

// --- §1.2 column shape -------------------------------------------------------
export interface PropertyRow {
  property_key: string;
  client_id: string;
  property_name: string;
  property_name_normalized: string;
  status: string; // 'pending' | 'active' | 'closed' | 'rejected'
  is_demo: boolean;
  deal_type: string; // '賃貸' | '売買' (raw extractor value, not re-translated)
  address: string;
  nearest_station: string;
  floor_plan: string;
  floor_area_m2: number;
  floor_number: string;
  building_age_years: number;
  monthly_rent_yen: number;
  sale_price_yen: number;
  management_fee_yen: number;
  deposit_key_money_note: string;
  price_label: string; // pre-formatted, do not re-format (design §1.2 row18)
  key_features_json: string; // raw JSON-array string
  catch_copy_1: string;
  catch_copy_2: string;
  caption_instagram: string;
  caption_tiktok: string;
  staged: boolean;
  video_url_raw: string;
  video_url_permanent: string;
  approval_id: string;
  exec_id: string;
  manifest_url: string;
  portfolio_enabled: boolean; // PER-PROPERTY /f gate (§7.2 point 2) — distinct
  // from the Client-level `portfolio_enabled` string field in types.ts, which
  // gates the whole /f/[slug] page. Both must be true (AND) for a property
  // to render on /f.
  created_at: string;
  updated_at: string;
  published_at: string;
  expires_at: string;
  closed_at: string;
  closed_reported_by: string;
  rejected_at: string;
}

function toBool(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1";
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowToProperty(headers: string[], row: string[]): PropertyRow {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  return {
    property_key: obj.property_key ?? "",
    client_id: obj.client_id ?? "",
    property_name: obj.property_name ?? "",
    property_name_normalized: obj.property_name_normalized ?? "",
    status: obj.status ?? "",
    is_demo: toBool(obj.is_demo),
    deal_type: obj.deal_type ?? "",
    address: obj.address ?? "",
    nearest_station: obj.nearest_station ?? "",
    floor_plan: obj.floor_plan ?? "",
    floor_area_m2: toNum(obj.floor_area_m2),
    floor_number: obj.floor_number ?? "",
    building_age_years: toNum(obj.building_age_years),
    monthly_rent_yen: toNum(obj.monthly_rent_yen),
    sale_price_yen: toNum(obj.sale_price_yen),
    management_fee_yen: toNum(obj.management_fee_yen),
    deposit_key_money_note: obj.deposit_key_money_note ?? "",
    price_label: obj.price_label ?? "",
    key_features_json: obj.key_features_json ?? "",
    catch_copy_1: obj.catch_copy_1 ?? "",
    catch_copy_2: obj.catch_copy_2 ?? "",
    caption_instagram: obj.caption_instagram ?? "",
    caption_tiktok: obj.caption_tiktok ?? "",
    staged: toBool(obj.staged),
    video_url_raw: obj.video_url_raw ?? "",
    video_url_permanent: obj.video_url_permanent ?? "",
    approval_id: obj.approval_id ?? "",
    exec_id: obj.exec_id ?? "",
    manifest_url: obj.manifest_url ?? "",
    portfolio_enabled: toBool(obj.portfolio_enabled),
    created_at: obj.created_at ?? "",
    updated_at: obj.updated_at ?? "",
    published_at: obj.published_at ?? "",
    expires_at: obj.expires_at ?? "",
    closed_at: obj.closed_at ?? "",
    closed_reported_by: obj.closed_reported_by ?? "",
    rejected_at: obj.rejected_at ?? "",
  };
}

/**
 * Reads the `物件` tab of a client's LINE data spreadsheet (their
 * line_data_sheet_id — NEVER the central GOOGLE_SHEET_ID). Fail-soft
 * (mirrors getLineKnowledge/getProductionRows): a tab that hasn't been
 * created yet for a given client (rollout not there yet), a wrong/renamed
 * tab, or any Sheets API error all just yield [] — the /f page must render
 * an empty-state, never a 500, when the property DB hasn't caught up to a
 * given client yet.
 */
export async function getProperties(
  spreadsheetId: string
): Promise<PropertyRow[]> {
  if (!spreadsheetId) return [];
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId,
      range: qt(TAB()),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0] as string[];
    return rows.slice(1).map((r) => rowToProperty(headers, r as string[]));
  } catch {
    return [];
  }
}

// --- §2.1 visibility gate (THE 3-guard, absolute condition) -----------------
// feedback_sugita_compliance's 2-week rule: expires_at is computed as
// published_at + this many days at write time (n8n side), and independently
// re-validated here on every read — this constant is documentation only,
// not itself part of the gate (the gate trusts expires_at, not a re-derived
// window, per design §0's read-time-recompute principle).
export const ACTIVE_WINDOW_DAYS = 14;

/**
 * §2.1's 3-guard visibility check, byte-for-byte the same decision tree as
 * the design doc's reference JS. `is_demo` bypasses the whole state machine
 * (always visible) — used for the 白金台 demo, which has no real 物件 row at
 * all. Every other row must pass all 3 independent guards: an explicit
 * status allowlist, a closed_at safety valve independent of status, and an
 * expires_at check that never trusts a cron to have run.
 */
export function isPropertyVisible(
  row: PropertyRow | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!row) return false;
  if (row.is_demo === true) return true;

  // ガード1: ステータスの明示的ホワイトリスト(既定=非表示)
  if (String(row.status || "").trim() !== "active") return false;

  // ガード2: 成約報告タイムスタンプは status 列と独立した安全弁
  if (String(row.closed_at || "").trim() !== "") return false;

  // ガード3: 期限切れはcronの実行に依存しない
  const exp = Date.parse(row.expires_at);
  if (!Number.isFinite(exp) || nowMs >= exp) return false;

  return true;
}

/**
 * §2.1's second function: "成約済み" badge display (price/CTA suppressed),
 * separate from the main visibility gate — a closed property is NOT visible
 * via isPropertyVisible, but may still render for exactly 7 days as a
 * closed-badge card via this function.
 */
export function isRecentlyClosed(
  row: PropertyRow | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!row) return false;
  if (row.is_demo) return false;
  if (String(row.status || "").trim() !== "closed") return false;
  const days = (nowMs - Date.parse(row.closed_at)) / 86400000;
  return Number.isFinite(days) && days <= 7;
}
