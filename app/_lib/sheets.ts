import { google } from "googleapis";
import type { Client } from "./types";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const TAB = process.env.GOOGLE_SHEET_TAB || "リスト";

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
    company_name: obj.company_name ?? "",
    plan: obj.plan ?? "",
    secret_key: obj.secret_key ?? "",
    monthly_quota: Number(obj.monthly_quota) || 0,
    used_this_month: Number(obj.used_this_month) || 0,
    quota_reset: obj.quota_reset ?? "",
    bgm_url: obj.bgm_url ?? "",
    cover_image_url: obj.cover_image_url ?? "",
    font_family: obj.font_family ?? "",
    accent_color: obj.accent_color ?? "",
    video_mode: obj.video_mode ?? "",
    next_post_slot: obj.next_post_slot ?? "",
    require_approval: obj.require_approval ?? "",
    approval_email: obj.approval_email ?? "",
    line_channel_token: obj.line_channel_token ?? "",
    line_channel_secret: obj.line_channel_secret ?? "",
    line_bot_user_id: obj.line_bot_user_id ?? "",
    line_data_sheet_id: obj.line_data_sheet_id ?? "",
    client_folder_id: obj.client_folder_id ?? "",
  };
}

export async function getAllClients(): Promise<Client[]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}`,
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
    range: `${TAB}`,
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
    range: `${TAB}!A${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [existing] },
  });
}

export async function addClient(data: Client): Promise<void> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1:1`,
  });
  const headers = (res.data.values?.[0] as string[]) ?? [];
  if (!headers.length) throw new Error("No headers in sheet");

  const row = headers.map((h) => {
    const val = (data as unknown as Record<string, unknown>)[h];
    return val != null ? String(val) : "";
  });

  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}
