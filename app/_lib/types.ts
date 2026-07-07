// Client shape mirrors the real "契約社リスト" sheet tab exactly (19 columns).
// Do NOT add fields that aren't real columns in that sheet — sheets.ts reads/writes
// by header name, so a phantom field here silently no-ops on write and reads as "".
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
