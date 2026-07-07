// Client shape mirrors the real "契約社リスト" sheet tab exactly (19 columns).
// Do NOT add fields that aren't real columns in that sheet — sheets.ts reads/writes
// by header name, so a phantom field here silently no-ops on write and reads as "".
export interface Client {
  client_id: string;
  secret_key: string;
  client_name: string;
  plan: "light" | "standard" | "premium" | string;
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
  video: { label: "動画生成", plans: ["light", "standard", "premium"] },
  sns: { label: "SNS自動投稿", plans: ["standard", "premium"] },
  line_ai: { label: "LINE AI", plans: ["premium"] },
};

export const PLAN_LABELS: Record<string, string> = {
  light: "ライト",
  standard: "スタンダード",
  premium: "プレミアム",
};

export const PLAN_COLORS: Record<string, string> = {
  light: "bg-gray-100 text-gray-700",
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
