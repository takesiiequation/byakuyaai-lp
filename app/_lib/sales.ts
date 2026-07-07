import { google } from "googleapis";

// Separate spreadsheet from the main 契約社リスト (sheets.ts). Read-only viewer
// for the sales/prospect company list — the service account only needs Viewer
// access here, so a narrower scope than sheets.ts is requested intentionally.
const SHEET_ID = () => process.env.SALES_SHEET_ID;
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export interface SalesTabData {
  headers: string[];
  rows: string[][];
}

/** Lists every tab (sheet) name in the sales spreadsheet, in sheet order. */
export async function getSalesTabs(): Promise<string[]> {
  const id = SHEET_ID();
  if (!id) throw new Error("SALES_SHEET_ID is not set");
  const res = await sheets().spreadsheets.get({
    spreadsheetId: id,
    fields: "sheets.properties.title",
  });
  return (res.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
}

/**
 * Returns the raw grid of a single tab: row 0 = headers, the rest = data rows
 * padded/truncated to the header width so the UI can zip them safely. Never
 * throws — a missing/renamed tab or an empty sheet just yields no rows
 * (fail-soft, mirrors sheets.ts's getApprovalQueue pattern).
 */
export async function getSalesTabData(tab: string): Promise<SalesTabData> {
  const id = SHEET_ID();
  if (!id) throw new Error("SALES_SHEET_ID is not set");
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: id,
      range: qt(tab),
    });
    const values = res.data.values as string[][] | undefined;
    if (!values || values.length === 0) return { headers: [], rows: [] };

    const headers = (values[0] ?? []).map((h) => String(h ?? ""));
    const width = headers.length;
    if (width === 0) return { headers: [], rows: [] };

    const rows = values.slice(1).map((r) => {
      const row = (r ?? []).slice(0, width).map((c) => String(c ?? ""));
      while (row.length < width) row.push("");
      return row;
    });

    return { headers, rows };
  } catch {
    return { headers: [], rows: [] };
  }
}
