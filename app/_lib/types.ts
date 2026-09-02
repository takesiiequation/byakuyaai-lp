// Client shape mirrors the real "契約社リスト" sheet tab. sheets.ts reads/writes
// by header name, so a phantom field here silently no-ops on write and reads
// as "" — do NOT add fields that aren't real columns in that sheet.
//
// link_hp_url / link_line_url / drive_folder_id (2026-07-11, admin
// operability v1) are 3 NEW columns — they must be added to the actual
// 契約社リスト sheet (headers row) before this UI can read/write them; until
// then they'll just read as "" (fail-soft, not a crash).
export interface Client {
  client_id: string;
  secret_key: string;
  client_name: string;
  plan: "test" | "standard" | "premium" | string;
  tone: "casual" | "polite" | string;
  monthly_quota: number;
  used_this_month: number;
  quota_reset: string;
  publer_ig_account_id: string;
  publer_tt_account_id: string;
  notify_email: string;
  status: "trial" | "active" | "paused" | string;
  next_post_slot: string;
  require_approval: string;
  approval_email: string;
  line_channel_token: string;
  line_channel_secret: string;
  line_bot_user_id: string;
  line_data_sheet_id: string;
  link_hp_url: string;
  link_line_url: string;
  drive_folder_id: string;
  // portal_password / portal_enabled (2026-07-12, 顧客ポータルP1 — see
  // docs/property_db_f_design.md §P1.1) are 2 NEW columns — same caveat as
  // link_hp_url above: must be added to the actual 契約社リスト sheet header
  // row before they're readable; until then they read as "" (fail-soft).
  // portal_password is plain text (same operational trust level as
  // ADMIN_PASSWORD — Okamoto sets it by hand per client during onboarding).
  // portal_enabled follows the same 'true'/空 fail-safe pattern as
  // portfolio_enabled: anything other than the literal string 'true' is
  // non-public.
  portal_password: string;
  portal_enabled: string;
  // license_number / transaction_type_default / portfolio_slug /
  // portfolio_enabled / line_staff_user_ids (2026-07-12, 物件DB+/f — see
  // docs/property_db_f_design.md §1.3) are 5 MORE new columns, same caveat:
  // must be added to the actual 契約社リスト sheet header row before
  // they're readable; until then they read as "" (fail-soft).
  // portfolio_slug/portfolio_enabled follow the same 'true'/空 fail-safe
  // pattern as portal_enabled: empty slug or anything other than the
  // literal string 'true' means the client's /f/[slug] page 404s.
  license_number: string;
  transaction_type_default: string;
  portfolio_slug: string;
  portfolio_enabled: string;
  line_staff_user_ids: string;
  report_enabled: string; // 'true'=月次レポート配信ON(プランと独立・2026-08-01)
  workspace_enabled: string; // 'true'=ユキのデスク(エージェントユキ)ON(プランと独立・2026-09-02)
  invoice_enabled: string; // 'true'=請求書・領収書発行ON(プランと独立・2026-08-02)
  line_notify_email: string; // LINE問い合わせ通知の専用宛先(空=approval_emailにフォールバック・2026-08-07)
  quota_no_reset: string; // 'true'=月次クォータの自動リセットをしない(使い切り型・2026-08-03)
}

// Lets the "顧客フォルダ" field accept a pasted Google Drive folder URL
// (https://drive.google.com/drive/folders/<id>[...] or
// https://drive.google.com/open?id=<id>) and store just the bare ID, which
// is what the Drive API (createLineDataSheet's addParents, health checks,
// "顧客フォルダを開く" links) actually needs. Anything that isn't a
// recognized Drive URL is returned trimmed as-is — this also covers the
// common case where the operator already pastes a bare ID.
export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (foldersMatch) return foldersMatch[1];
  const openIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openIdMatch) return openIdMatch[1];
  return trimmed;
}

export const PLAN_FEATURES: Record<string, { label: string; plans: string[] }> = {
  video: { label: "動画生成", plans: ["test", "standard", "premium"] },
  sns: { label: "SNS自動投稿", plans: ["test", "standard", "premium"] },
  line_ai: { label: "LINE AI", plans: ["test", "premium"] },
};

export const PLAN_LABELS: Record<string, string> = {
  test: "テスト",
  standard: "スタンダード",
  premium: "プレミアム",
};

export const PLAN_COLORS: Record<string, string> = {
  test: "bg-purple-100 text-purple-700",
  standard: "bg-blue-100 text-blue-700",
  premium: "bg-amber-100 text-amber-700",
};

export const TONE_LABELS: Record<string, string> = {
  casual: "カジュアル",
  polite: "丁寧",
};

export const STATUS_LABELS: Record<string, string> = {
  trial: "トライアル",
  active: "稼働中",
  paused: "停止中",
};

export const STATUS_COLORS: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  paused: "bg-gray-200 text-gray-500",
};

// BGM/SE media library upload limit. Shared between the client uploader
// (early UX feedback) and the /api/media route (authoritative server-side
// check) so the two never drift apart.
export const MEDIA_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MEDIA_MAX_FILE_SIZE_LABEL = "20MB";

// --- AI model registry (/admin/models) ------------------------------------
// Types/constants/pure-validation live here (not in _lib/models.ts) so the
// "use client" admin page can import them without pulling in models.ts's
// `googleapis` import — that pulls in Node-only modules (net/tls) that break
// the client bundle. models.ts (server-only, does the actual Sheets I/O)
// imports these back from here.
export interface ModelDef {
  model_id: string;
  label: string;
  endpoint_url: string;
  body_template: string;
  duration: string;
  resolution: string;
  notes: string;
  active: boolean;
}

export interface PlanAssignment {
  plan: string;
  model_id: string;
}

// The three plan "slots" the admin UI assigns a model to. Same value set as
// PLAN_LABELS above since 2026-07-08 (light retired; "test" is the internal
// plan used by byakuyaai_test — never sold, but it IS a real plan value in
// the 契約社リスト sheet).
export const PLAN_KEYS = ["standard", "premium", "test"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];
export const PLAN_SLOT_LABELS: Record<PlanKey, string> = {
  standard: "スタンダード",
  premium: "プレミアム",
  test: "テスト",
};

export const REQUIRED_PLACEHOLDERS = ["{{image_url}}", "{{prompt}}"] as const;
export const OPTIONAL_PLACEHOLDERS = [
  "{{duration}}",
  "{{aspect_ratio}}",
  "{{resolution}}",
] as const;

// Shared by /api/models and /api/models/assist (assist's AI output is
// validated the same way a manual save is — never trusted directly).
export function validateBodyTemplate(
  raw: string
): { ok: true } | { ok: false; error: string } {
  if (!raw || !raw.trim()) {
    return { ok: false, error: "body_templateは必須です" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "body_templateが正しいJSON形式ではありません" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      error: "body_templateはJSONオブジェクトである必要があります",
    };
  }
  const missing = REQUIRED_PLACEHOLDERS.filter((p) => !raw.includes(p));
  if (missing.length) {
    return {
      ok: false,
      error: `必須プレースホルダが不足しています: ${missing.join(", ")}`,
    };
  }
  return { ok: true };
}

// --- Banned-word list (/admin/banned-words) --------------------------------
// Types/constants live here (not in _lib/bannedWords.ts) for the same reason
// as the model registry above: the "use client" admin page must not pull in
// bannedWords.ts's `googleapis` import.
//
// Seed content mirrors the current n8n-hardcoded 11-word list (OKAMOTO_TODO
// 2026-07-12, "禁止語のadmin管理化"): 4 "shape" words that survive if the
// マイソク text actually mentions them, 7 "valueless" words removed
// unconditionally. n8n reads this sheet at execution start and falls back to
// that same hardcoded list (fail-open) if the read fails — the admin UI is
// additive, it doesn't replace the fallback.
export interface BannedWord {
  word: string;
  type: "shape" | "valueless" | string;
  enabled: boolean;
}

export const BANNED_WORD_TYPES = ["shape", "valueless"] as const;
export type BannedWordType = (typeof BANNED_WORD_TYPES)[number];
export const BANNED_WORD_TYPE_LABELS: Record<BannedWordType, string> = {
  shape: "形状語(マイソク記載なら通す)",
  valueless: "無価値語(無条件除去)",
};
