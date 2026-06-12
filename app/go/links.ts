// 計測リンクの転送先マップ(顧客オンボーディング時にここへ追記)
// URL 形式: byakuyaai.com/go/<client_id>/hp | /line
export const LINKS: Record<string, { hp: string; line?: string }> = {
  sugita: {
    hp: "https://www.sugitasyoji.co.jp/",
    // LINE 公式アカウント開設後に line を追加(未設定時は hp にフォールバック)
  },
  byakuyaai_test: {
    hp: "https://byakuyaai.com/",
  },
};

export const FALLBACK = "https://byakuyaai.com/";
