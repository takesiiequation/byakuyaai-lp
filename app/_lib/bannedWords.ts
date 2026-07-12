import { google } from "googleapis";
import type { BannedWord } from "./types";

// Banned-word list registry (/admin/banned-words). Same tab-inside-the-
// contract-list-spreadsheet pattern as models.ts (モデル登録/プラン設定):
// auto-created on first use (see ensureBannedWordsTab), seeded with the
// current n8n-hardcoded 11-word list so nothing changes behaviorally until
// someone actually edits here. n8n will read this tab directly at execution
// start with fail-open fallback to that same hardcoded list if the read
// fails (OKAMOTO_TODO 2026-07-12, "禁止語のadmin管理化") — this module is the
// data layer + admin UI only, writes here never touch the live pipeline
// until that n8n-side read is wired up separately.
export type { BannedWord } from "./types";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const BANNED_WORDS_TAB =
  process.env.GOOGLE_SHEET_BANNED_WORDS_TAB || "禁止語";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須

const BANNED_WORDS_HEADERS = ["word", "type", "enabled"] as const;

// Current n8n hardcoded list (OKAMOTO_TODO 2026-07-12): 形状語4(マイソク記載
// なら通す)・無価値語7(無条件除去)。All enabled=true — the seed preserves
// today's behavior exactly; disabling/adding/removing entries is the whole
// point of this admin page.
const SEED_BANNED_WORDS: BannedWord[] = [
  { word: "L字", type: "shape", enabled: true },
  { word: "アイランドキッチン", type: "shape", enabled: true },
  { word: "アイランド型", type: "shape", enabled: true },
  { word: "大理石", type: "shape", enabled: true },
  { word: "室外機", type: "valueless", enabled: true },
  { word: "給湯器", type: "valueless", enabled: true },
  { word: "ブレーカー", type: "valueless", enabled: true },
  { word: "分電盤", type: "valueless", enabled: true },
  { word: "換気口", type: "valueless", enabled: true },
  { word: "換気扇", type: "valueless", enabled: true },
  { word: "物干し金具", type: "valueless", enabled: true },
];

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

// --- bootstrap: create tab + header + seed data if missing -----------------
async function getSheetTitles(): Promise<string[]> {
  const res = await sheets().spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties.title",
  });
  return (res.data.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
}

async function ensureHeader(
  tab: string,
  headers: readonly string[]
): Promise<void> {
  const lastCol = String.fromCharCode(64 + headers.length); // headers.length <= 26
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${qt(tab)}!A1:${lastCol}1`,
  });
  const existing = res.data.values?.[0];
  if (existing && existing.length > 0) return; // header already present
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${qt(tab)}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [Array.from(headers)] },
  });
}

async function getBannedWordsGrid(): Promise<{
  headers: string[];
  rows: string[][];
}> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(BANNED_WORDS_TAB),
  });
  const values = res.data.values as string[][] | undefined;
  if (!values || values.length === 0) return { headers: [], rows: [] };
  return { headers: values[0] ?? [], rows: values.slice(1) };
}

async function seedMissingBannedWords(): Promise<void> {
  const { headers, rows } = await getBannedWordsGrid();
  const wordCol = headers.indexOf("word");
  const existingWords = new Set(
    rows.map((r) => (wordCol === -1 ? "" : r[wordCol] ?? ""))
  );
  const missing = SEED_BANNED_WORDS.filter((w) => !existingWords.has(w.word));
  if (!missing.length) return;
  const useHeaders = headers.length ? headers : Array.from(BANNED_WORDS_HEADERS);
  const values = missing.map((w) =>
    useHeaders.map((h) => String((w as unknown as Record<string, unknown>)[h] ?? ""))
  );
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(BANNED_WORDS_TAB)}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/**
 * Idempotent bootstrap: creates the "禁止語" tab if missing, writes the
 * header if the tab exists but is header-less, then seeds any of the 11
 * default words that aren't already present (matched by word, so a
 * manually-edited sheet is never clobbered). Safe to call on every request —
 * cheap no-op once bootstrapped (mirrors models.ts's ensureModelTabs).
 */
export async function ensureBannedWordsTab(): Promise<void> {
  const titles = await getSheetTitles();
  if (!titles.includes(BANNED_WORDS_TAB)) {
    await sheets().spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          { addSheet: { properties: { title: BANNED_WORDS_TAB } } },
        ],
      },
    });
  }

  await ensureHeader(BANNED_WORDS_TAB, BANNED_WORDS_HEADERS);
  await seedMissingBannedWords();
}

// --- 禁止語 CRUD -------------------------------------------------------------
function rowToBannedWord(headers: string[], row: string[]): BannedWord {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  const enabledRaw = (obj.enabled ?? "").trim().toLowerCase();
  return {
    word: obj.word ?? "",
    type: obj.type ?? "",
    enabled: enabledRaw === "true" || enabledRaw === "1",
  };
}

export async function getAllBannedWords(): Promise<BannedWord[]> {
  const { headers, rows } = await getBannedWordsGrid();
  if (!headers.length) return [];
  const wordCol = headers.indexOf("word");
  return rows
    .filter((r) => (wordCol === -1 ? false : (r[wordCol] ?? "") !== ""))
    .map((r) => rowToBannedWord(headers, r));
}

export async function addBannedWord(data: BannedWord): Promise<void> {
  const { headers } = await getBannedWordsGrid();
  const useHeaders = headers.length ? headers : Array.from(BANNED_WORDS_HEADERS);
  const row = useHeaders.map((h) => {
    const v = (data as unknown as Record<string, unknown>)[h];
    return v != null ? String(v) : "";
  });
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(BANNED_WORDS_TAB)}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function updateBannedWord(
  word: string,
  data: Partial<BannedWord>
): Promise<void> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(BANNED_WORDS_TAB),
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error("禁止語タブが空です");

  const headers = rows[0] as string[];
  const wordCol = headers.indexOf("word");
  if (wordCol === -1) throw new Error("word列が見つかりません");

  const rowIdx = rows.findIndex(
    (r, i) => i > 0 && (r as string[])[wordCol] === word
  );
  if (rowIdx === -1) throw new Error(`禁止語「${word}」が見つかりません`);

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
    range: `${qt(BANNED_WORDS_TAB)}!A${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [existing] },
  });
}

export async function deleteBannedWord(word: string): Promise<void> {
  const { headers, rows } = await getBannedWordsGrid();
  if (!headers.length) return;
  const wordCol = headers.indexOf("word");
  const remaining = rows.filter((r) => (r[wordCol] ?? "") !== word);

  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: qt(BANNED_WORDS_TAB),
  });
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${qt(BANNED_WORDS_TAB)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers, ...remaining] },
  });
}
