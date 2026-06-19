export interface Client {
  client_id: string;
  company_name: string;
  plan: "light" | "standard" | "premium" | string;
  secret_key: string;
  monthly_quota: number;
  used_this_month: number;
  quota_reset: string;
  bgm_url: string;
  cover_image_url: string;
  font_family: string;
  accent_color: string;
  video_mode: string;
  next_post_slot: string;
  require_approval: string;
  approval_email: string;
  line_channel_token: string;
  line_channel_secret: string;
  line_bot_user_id: string;
  line_data_sheet_id: string;
  client_folder_id: string;
  blocked: string;
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
