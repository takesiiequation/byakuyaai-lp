import { google } from "googleapis";

// LINE Bot knowledge editor (/admin/line). Unlike sheets.ts (契約社リスト, one
// fixed spreadsheet) and sales.ts (one fixed spreadsheet), this operates on a
// *different* spreadsheet per client — the one named by that client's
// line_data_sheet_id column. The spreadsheet id itself must never come
// straight from the browser (see the API route): it is always looked up
// server-side from the contract-list sheet by client_id, so a tampered
// request can only ever touch the sheet already tied to that client_id.
const TAB = () => process.env.LINE_KNOWLEDGE_TAB || "LINEナレッジ";
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

export interface KnowledgeData {
  headers: string[];
  rows: string[][];
}

/**
 * Reads the LINEナレッジ tab of a client's LINE data spreadsheet.
 * Row 0 = headers, the rest = data rows padded/truncated to header width.
 * Never throws — a missing tab, a not-yet-onboarded/renamed sheet, or an
 * empty sheet all just yield { headers: [], rows: [] } (fail-soft, mirrors
 * sales.ts's getSalesTabData), so the admin page can show a friendly
 * "ナレッジタブが見つかりません" instead of a 500.
 */
export async function getLineKnowledge(
  spreadsheetId: string
): Promise<KnowledgeData> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId,
      range: qt(TAB()),
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

/**
 * Full replace of the LINEナレッジ tab's data: clears the tab, then writes
 * back the header row plus the given data rows. Clearing first (rather than
 * a bare values.update over the old range) matters when the edited row count
 * shrank — otherwise stale trailing rows from the previous save would survive
 * untouched below the new data.
 */
export async function updateLineKnowledge(
  spreadsheetId: string,
  headers: string[],
  rows: string[][]
): Promise<void> {
  const tab = TAB();
  const client = sheets();

  await client.spreadsheets.values.clear({
    spreadsheetId,
    range: qt(tab),
  });

  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${qt(tab)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers, ...rows] },
  });
}
