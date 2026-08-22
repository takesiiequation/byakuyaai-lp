import { google } from "googleapis";

// Storage for the personal tracker (/me). Deliberately a SEPARATE TAB, never
// new columns on 契約社リスト: the 2026-07-26 portal_enabled overwrite
// accident came from widening an existing sheet, and this log has no business
// touching the client roster at all. Shape is two columns — date | json —
// one row per day, so the tab can never develop a column-alignment problem.
const TAB = process.env.ME_SHEET_TAB || "85点ログ";
const SHEET_ID = () => process.env.ME_SHEET_ID || process.env.GOOGLE_SHEET_ID!;
const qt = (t: string) => `'${t.replace(/'/g, "''")}'`;

function sheets() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export type DayLog = Record<string, unknown>;
export type LogState = { days: Record<string, DayLog> };

async function ensureTab(): Promise<void> {
  const api = sheets();
  const id = SHEET_ID();
  const meta = await api.spreadsheets.get({ spreadsheetId: id });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === TAB
  );
  if (exists) return;
  await api.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
  });
  await api.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${qt(TAB)}!A1:B1`,
    valueInputOption: "RAW",
    requestBody: { values: [["date", "json"]] },
  });
}

/** Whole log. Rows that fail to parse are skipped rather than throwing —
 * one corrupt cell must not make the entire history unreadable. */
export async function readLog(): Promise<LogState> {
  await ensureTab();
  const api = sheets();
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `${qt(TAB)}!A2:B10000`,
  });
  const days: Record<string, DayLog> = {};
  for (const row of res.data.values || []) {
    const [date, json] = row as string[];
    if (!date || !json) continue;
    try {
      days[date] = JSON.parse(json);
    } catch {
      /* skip unreadable row */
    }
  }
  return { days };
}

/** Upsert only the days present in `patch`. Days absent from the patch are
 * left untouched, so a stale client can never blank out history it did not
 * load. Written as one batched update keyed by the existing row index. */
export async function writeLog(patch: LogState): Promise<number> {
  await ensureTab();
  const api = sheets();
  const id = SHEET_ID();
  const res = await api.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${qt(TAB)}!A2:A10000`,
  });
  const existing = (res.data.values || []).map((r) => (r[0] as string) || "");
  const rowOf = new Map<string, number>();
  existing.forEach((d, i) => {
    if (d) rowOf.set(d, i + 2);
  });

  const updates: { range: string; values: string[][] }[] = [];
  const appends: string[][] = [];
  for (const [date, day] of Object.entries(patch.days || {})) {
    const json = JSON.stringify(day);
    const row = rowOf.get(date);
    if (row) {
      updates.push({ range: `${qt(TAB)}!A${row}:B${row}`, values: [[date, json]] });
    } else {
      appends.push([date, json]);
    }
  }

  if (updates.length) {
    await api.spreadsheets.values.batchUpdate({
      spreadsheetId: id,
      requestBody: { valueInputOption: "RAW", data: updates },
    });
  }
  if (appends.length) {
    await api.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${qt(TAB)}!A:B`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends },
    });
  }
  return updates.length + appends.length;
}
