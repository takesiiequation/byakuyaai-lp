import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const REPORT_TAB = process.env.GOOGLE_SHEET_REPORT_TAB || "月次レポート";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須(sheets.tsと同じ規約)

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

// --- report_json shape ------------------------------------------------
// Two documents in fudosan-video describe this payload and they don't
// 100% agree on field names:
//   - scripts/generate_monthly_report.py (A4 HTML generator, the "spec"
//     this task points at): top-level `period`, `accounts` as an object,
//     top-level `next_actions`, `highlight.comment`.
//   - scripts/build_monthly_report_workflow.py's JS_BUILD_DATA/JS_HTML
//     (what actually mails today): `period_label`, `accounts` as a
//     string array, `copy.next_actions`, `copy.highlight_comment` +
//     `copy.mail_intro`, `highlight` without `.comment`.
// The "月次レポート" sheet tab n8n writes report_json into is being built
// in parallel by a separate change, so which of the two this ends up
// matching isn't known yet. Every accessor below therefore checks both
// spellings — whichever one is actually populated wins, and if neither
// is, the UI just omits that piece instead of rendering blank/garbled.
export interface ReportVideo {
  date?: string;
  title?: string;
  platform?: string;
  views?: number;
  likes?: number;
  saves?: number;
  comments?: number;
}

export interface ReportSummary {
  views?: number;
  reach?: number;
  likes?: number;
  saves?: number;
  posts?: number;
  hp_clicks?: number;
  line_clicks?: number;
  follower_delta?: number;
}

export interface ReportHighlight {
  title?: string;
  views?: number;
  saves?: number;
  comment?: string;
}

export interface ReportCopy {
  mail_intro?: string;
  highlight_comment?: string;
  next_actions?: string[];
}

export interface MonthlyReport {
  client_id?: string;
  client_name?: string;
  period?: string;
  period_label?: string;
  accounts?: string[] | Record<string, string>;
  summary?: ReportSummary;
  prev_summary?: ReportSummary | null;
  prev_hp_clicks?: number;
  prev_line_clicks?: number;
  videos?: ReportVideo[];
  highlight?: ReportHighlight | null;
  next_actions?: string[];
  copy?: ReportCopy;
  total_videos?: number;
}

export interface MonthlyReportRow {
  client_id: string;
  /** 'YYYY-MM' */
  year_month: string;
  generated_at: string;
  report: MonthlyReport;
}

/**
 * Fail-soft, header-driven read of the "月次レポート" tab (mirrors the
 * sheets.ts/billing.ts pattern used elsewhere in this app). Returns null
 * on ANY problem — missing/renamed tab, missing columns, no row for this
 * client, unparseable JSON in a row — all of which collapse to the same
 * "nothing to show yet" state for the caller. This tab is being populated
 * by a separate n8n-side change landing around the same time as this UI,
 * so empty/absent is an expected, not exceptional, state.
 */
export async function getLatestReport(
  clientId: string
): Promise<MonthlyReportRow | null> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(REPORT_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return null;

    const headers = rows[0] as string[];
    const idCol = headers.indexOf("client_id");
    const ymCol = headers.indexOf("year_month");
    const genCol = headers.indexOf("generated_at");
    const jsonCol = headers.indexOf("report_json");
    if (idCol === -1 || ymCol === -1 || jsonCol === -1) return null;

    let best: MonthlyReportRow | null = null;
    for (const r of rows.slice(1)) {
      const row = r as string[];
      if ((row[idCol] ?? "") !== clientId) continue;
      const year_month = (row[ymCol] ?? "").trim();
      if (!year_month) continue;
      // 'YYYY-MM' 文字列は辞書順=時系列順なので単純比較でOK
      if (best && year_month <= best.year_month) continue;

      let report: MonthlyReport;
      try {
        const parsed = JSON.parse(row[jsonCol] ?? "");
        if (!parsed || typeof parsed !== "object") continue;
        report = parsed as MonthlyReport;
      } catch {
        continue; // 壊れたJSON行はスキップ(他の月に有効な行があれば拾う)
      }

      best = {
        client_id: row[idCol],
        year_month,
        generated_at: genCol !== -1 ? row[genCol] ?? "" : "",
        report,
      };
    }
    return best;
  } catch {
    return null;
  }
}

// --- Defensive field accessors (used by the portal UI) -----------------
export function reportPeriodLabel(r: MonthlyReport, yearMonth: string): string {
  return r.period_label || r.period || yearMonth;
}

export function reportAccountsLabel(r: MonthlyReport): string {
  if (!r.accounts) return "—";
  if (Array.isArray(r.accounts)) {
    const vals = r.accounts.filter(Boolean);
    return vals.length ? vals.join(" / ") : "—";
  }
  const vals = Object.values(r.accounts).filter(Boolean);
  return vals.length ? vals.join(" / ") : "—";
}

export function reportNextActions(r: MonthlyReport): string[] {
  if (Array.isArray(r.next_actions) && r.next_actions.length) return r.next_actions;
  if (Array.isArray(r.copy?.next_actions) && r.copy!.next_actions!.length) {
    return r.copy!.next_actions!;
  }
  return [];
}

export function reportHighlightComment(r: MonthlyReport): string {
  return r.highlight?.comment || r.copy?.highlight_comment || "";
}

export function reportIntro(r: MonthlyReport): string {
  return r.copy?.mail_intro || "";
}

// hp_clicks/line_clicks の「前月」は production 実装(JS_BUILD_DATA)ではリンク
// クリック集計タブ由来でトップレベル prev_hp_clicks/prev_line_clicks に入る
// (prev_summary はPubler由来の指標のみで hp/line は持たない)。python 側の
// サンプル仕様は prev_summary.hp_clicks/.line_clicks を前提にしているため
// 両方を見る。
export function reportPrevHpClicks(r: MonthlyReport): number | undefined {
  return r.prev_hp_clicks ?? r.prev_summary?.hp_clicks;
}

export function reportPrevLineClicks(r: MonthlyReport): number | undefined {
  return r.prev_line_clicks ?? r.prev_summary?.line_clicks;
}
