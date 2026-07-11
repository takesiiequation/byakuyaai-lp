import { google } from "googleapis";
import type { Client } from "./types";

// Sheet health check for /admin/clients/[id]'s "健全性チェック" button.
// Verifies the shape onboarding (drive.ts's createLineDataSheet) is supposed
// to have produced, so a botched manual edit or partial onboarding run shows
// up as a concrete checklist instead of a silent LINE bot failure later.
const KNOWLEDGE_TAB = "LINEナレッジ";
const REQUIRED_TABS = ["LINEナレッジ", "LINE会話ログ", "内見予約"];
const EXPECTED_KNOWLEDGE_HEADER = [
  "client_id",
  "category",
  "title",
  "content",
  "enabled",
];
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ],
  });
}

function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function drive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export interface HealthCheckItem {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface HealthCheckResult {
  checks: HealthCheckItem[];
  all_ok: boolean;
}

/**
 * Never throws — each individual check catches its own API error and
 * reports itself as failed with a detail message, so one broken check (e.g.
 * a renamed tab) doesn't hide the rest of the checklist behind a 500.
 */
export async function checkClientHealth(
  client: Client
): Promise<HealthCheckResult> {
  const checks: HealthCheckItem[] = [];

  if (!client.line_data_sheet_id) {
    checks.push({
      key: "sheet_configured",
      label: "LINEデータシートが設定されている",
      ok: false,
      detail: "line_data_sheet_id が未設定です(セットアップ未実行)",
    });
    return { checks, all_ok: false };
  }
  checks.push({
    key: "sheet_configured",
    label: "LINEデータシートが設定されている",
    ok: true,
  });

  const sheetId = client.line_data_sheet_id;

  let tabTitles: string[] = [];
  try {
    const meta = await sheets().spreadsheets.get({
      spreadsheetId: sheetId,
      fields: "sheets.properties.title",
    });
    tabTitles = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => !!t);
    for (const tab of REQUIRED_TABS) {
      checks.push({
        key: `tab_${tab}`,
        label: `タブ「${tab}」が存在する`,
        ok: tabTitles.includes(tab),
      });
    }
  } catch (e) {
    checks.push({
      key: "tabs",
      label: "タブ構成の確認",
      ok: false,
      detail: String(e),
    });
  }

  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${qt(KNOWLEDGE_TAB)}!A1:E1`,
    });
    const header = (res.data.values?.[0] ?? []).map((c) => String(c ?? ""));
    const ok =
      header.length === EXPECTED_KNOWLEDGE_HEADER.length &&
      EXPECTED_KNOWLEDGE_HEADER.every((h, i) => header[i] === h);
    checks.push({
      key: "knowledge_header",
      label: "ナレッジタブの1行目が正しいヘッダー(5列)",
      ok,
      detail: ok ? undefined : `実際: [${header.join(", ") || "(空)"}]`,
    });
  } catch (e) {
    checks.push({
      key: "knowledge_header",
      label: "ナレッジタブのヘッダー確認",
      ok: false,
      detail: String(e),
    });
  }

  if (client.drive_folder_id) {
    try {
      const file = await drive().files.get({
        fileId: sheetId,
        fields: "parents",
      });
      const parents = file.data.parents ?? [];
      checks.push({
        key: "folder_match",
        label: "シートが顧客フォルダ内にある",
        ok: parents.includes(client.drive_folder_id),
        detail: parents.includes(client.drive_folder_id)
          ? undefined
          : `実際の親フォルダ: ${parents.join(", ") || "(取得不可)"}`,
      });
    } catch (e) {
      checks.push({
        key: "folder_match",
        label: "シートの親フォルダ確認",
        ok: false,
        detail: String(e),
      });
    }
  }

  const all_ok = checks.every((c) => c.ok);
  return { checks, all_ok };
}
