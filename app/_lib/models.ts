import { google } from "googleapis";
import type { ModelDef, PlanAssignment, PlanKey } from "./types";
import { PLAN_KEYS } from "./types";

// AI video-model registry (/admin/models). Two tabs inside the same
// GOOGLE_SHEET_ID spreadsheet used by sheets.ts (契約社リスト), auto-created on
// first use (see ensureModelTabs). n8n will read these tabs directly in a
// later change — this module is the data layer + admin UI only, so writes
// here never touch the live production workflow.
//
// Types/constants/validation shared with the client are defined in ./types
// (not here) — this file imports googleapis, which breaks a "use client"
// bundle if the admin page imports anything from this module directly.
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const MODELS_TAB = process.env.GOOGLE_SHEET_MODELS_TAB || "モデル登録";
const PLANS_TAB = process.env.GOOGLE_SHEET_PLANS_TAB || "プラン設定";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須

const MODELS_HEADERS = [
  "model_id",
  "label",
  "endpoint_url",
  "body_template",
  "duration",
  "resolution",
  "notes",
  "active",
] as const;

const PLANS_HEADERS = ["plan", "model_id"] as const;

export type { ModelDef, PlanAssignment };
export {
  PLAN_KEYS,
  PLAN_SLOT_LABELS,
  REQUIRED_PLACEHOLDERS,
  OPTIONAL_PLACEHOLDERS,
  validateBodyTemplate,
} from "./types";

// Identical for both seedance_720p / seedance_1080p — the actual resolution
// value lives only in the model's own `resolution` column, substituted into
// this placeholder at call time (not baked into the template per-variant).
const SEEDANCE_BODY_TEMPLATE = JSON.stringify({
  image_url: "{{image_url}}",
  prompt: "{{prompt}}",
  duration: "{{duration}}",
  aspect_ratio: "{{aspect_ratio}}",
  resolution: "{{resolution}}",
  generate_audio: false,
});

const SEED_MODELS: ModelDef[] = [
  {
    model_id: "seedance_720p",
    label: "Seedance 2.0 (720p)",
    endpoint_url: "https://queue.fal.run/bytedance/seedance-2.0/image-to-video",
    body_template: SEEDANCE_BODY_TEMPLATE,
    duration: "4",
    resolution: "720p",
    notes: "",
    active: true,
  },
  {
    model_id: "seedance_1080p",
    label: "Seedance 2.0 (1080p)",
    endpoint_url: "https://queue.fal.run/bytedance/seedance-2.0/image-to-video",
    body_template: SEEDANCE_BODY_TEMPLATE,
    duration: "4",
    resolution: "1080p",
    notes: "",
    active: true,
  },
  {
    model_id: "kling_v3_pro",
    label: "Kling v3 Pro",
    endpoint_url:
      "https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video",
    body_template: JSON.stringify({
      image_url: "{{image_url}}",
      prompt: "{{prompt}}",
      duration: "{{duration}}",
      aspect_ratio: "{{aspect_ratio}}",
      negative_prompt: "blur, distort, low quality",
    }),
    duration: "4",
    resolution: "",
    notes: "",
    active: true,
  },
];

const SEED_PLANS: Record<PlanKey, string> = {
  standard: "seedance_720p",
  premium: "seedance_1080p",
  test: "kling_v3_pro",
};

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

// --- bootstrap: create tabs + headers + seed data if missing -------------
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

async function seedMissingModels(): Promise<void> {
  const { headers, rows } = await getModelsGrid();
  const idCol = headers.indexOf("model_id");
  const existingIds = new Set(rows.map((r) => (idCol === -1 ? "" : r[idCol] ?? "")));
  const missing = SEED_MODELS.filter((m) => !existingIds.has(m.model_id));
  if (!missing.length) return;
  const useHeaders = headers.length ? headers : Array.from(MODELS_HEADERS);
  const values = missing.map((m) =>
    useHeaders.map((h) => String((m as unknown as Record<string, unknown>)[h] ?? ""))
  );
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(MODELS_TAB)}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

async function seedMissingPlans(): Promise<void> {
  const assignments = await getPlanAssignments();
  const existingPlans = new Set(assignments.map((a) => a.plan));
  const missing = (Object.entries(SEED_PLANS) as [PlanKey, string][]).filter(
    ([plan]) => !existingPlans.has(plan)
  );
  if (!missing.length) return;
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(PLANS_TAB)}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: missing.map(([plan, modelId]) => [plan, modelId]) },
  });
}

/**
 * Idempotent bootstrap: creates the "モデル登録"/"プラン設定" tabs if either is
 * missing, writes headers if a tab exists but is header-less, then seeds any
 * of the 3 default models / 3 default plan assignments that aren't already
 * present (matched by model_id / plan, so a manually-edited sheet is never
 * clobbered). Safe to call on every request — cheap no-op once bootstrapped.
 */
export async function ensureModelTabs(): Promise<void> {
  const titles = await getSheetTitles();
  const toCreate: { addSheet: { properties: { title: string } } }[] = [];
  if (!titles.includes(MODELS_TAB)) {
    toCreate.push({ addSheet: { properties: { title: MODELS_TAB } } });
  }
  if (!titles.includes(PLANS_TAB)) {
    toCreate.push({ addSheet: { properties: { title: PLANS_TAB } } });
  }
  if (toCreate.length) {
    await sheets().spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: toCreate },
    });
  }

  await ensureHeader(MODELS_TAB, MODELS_HEADERS);
  await ensureHeader(PLANS_TAB, PLANS_HEADERS);

  await seedMissingModels();
  await seedMissingPlans();
}

// --- モデル登録 CRUD -------------------------------------------------------
async function getModelsGrid(): Promise<{ headers: string[]; rows: string[][] }> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(MODELS_TAB),
  });
  const values = res.data.values as string[][] | undefined;
  if (!values || values.length === 0) return { headers: [], rows: [] };
  return { headers: values[0] ?? [], rows: values.slice(1) };
}

function rowToModel(headers: string[], row: string[]): ModelDef {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  const activeRaw = (obj.active ?? "").trim().toLowerCase();
  return {
    model_id: obj.model_id ?? "",
    label: obj.label ?? "",
    endpoint_url: obj.endpoint_url ?? "",
    body_template: obj.body_template ?? "",
    duration: obj.duration ?? "",
    resolution: obj.resolution ?? "",
    notes: obj.notes ?? "",
    active: activeRaw === "true" || activeRaw === "1",
  };
}

export async function getAllModels(): Promise<ModelDef[]> {
  const { headers, rows } = await getModelsGrid();
  if (!headers.length) return [];
  return rows
    .filter((r) => (r[headers.indexOf("model_id")] ?? "") !== "")
    .map((r) => rowToModel(headers, r));
}

export async function addModel(data: ModelDef): Promise<void> {
  const { headers } = await getModelsGrid();
  const useHeaders = headers.length ? headers : Array.from(MODELS_HEADERS);
  const row = useHeaders.map((h) => {
    const v = (data as unknown as Record<string, unknown>)[h];
    return v != null ? String(v) : "";
  });
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${qt(MODELS_TAB)}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function updateModel(
  modelId: string,
  data: Partial<ModelDef>
): Promise<void> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(MODELS_TAB),
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error("モデル登録タブが空です");

  const headers = rows[0] as string[];
  const idCol = headers.indexOf("model_id");
  if (idCol === -1) throw new Error("model_id列が見つかりません");

  const rowIdx = rows.findIndex(
    (r, i) => i > 0 && (r as string[])[idCol] === modelId
  );
  if (rowIdx === -1) throw new Error(`モデル ${modelId} が見つかりません`);

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
    range: `${qt(MODELS_TAB)}!A${rowNum}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [existing] },
  });
}

export async function deleteModel(modelId: string): Promise<void> {
  const { headers, rows } = await getModelsGrid();
  if (!headers.length) return;
  const idCol = headers.indexOf("model_id");
  const remaining = rows.filter((r) => (r[idCol] ?? "") !== modelId);

  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: qt(MODELS_TAB),
  });
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${qt(MODELS_TAB)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers, ...remaining] },
  });
}

// --- プラン設定 (full-replace, mirrors lineKnowledge.updateLineKnowledge) ---
export async function getPlanAssignments(): Promise<PlanAssignment[]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: qt(PLANS_TAB),
  });
  const values = res.data.values as string[][] | undefined;
  if (!values || values.length < 2) return [];
  const headers = values[0] ?? [];
  const planCol = headers.indexOf("plan");
  const modelCol = headers.indexOf("model_id");
  if (planCol === -1 || modelCol === -1) return [];
  return values
    .slice(1)
    .map((r) => ({ plan: r[planCol] ?? "", model_id: r[modelCol] ?? "" }))
    .filter((a) => a.plan);
}

export async function updatePlanAssignments(
  assignments: Record<string, string>
): Promise<void> {
  const rows = Object.entries(assignments)
    .filter(([, modelId]) => !!modelId)
    .map(([plan, modelId]) => [plan, modelId]);

  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: qt(PLANS_TAB),
  });
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${qt(PLANS_TAB)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [Array.from(PLANS_HEADERS), ...rows] },
  });
}
