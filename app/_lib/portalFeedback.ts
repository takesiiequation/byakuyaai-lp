// /portal/feedback の共有定数 + Discord通知(fail-soft)。
// Sheets書き込みは sheets.ts の appendFeedback を再利用する
// (SA機構の流儀を踏襲・ここには googleapis import を置かない)。

export const FEEDBACK_CATEGORIES = [
  "使いやすさ",
  "動画の仕上がり",
  "修正のしやすさ",
  "その他",
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

// フロント側の上限は1000字(FeedbackForm.tsx)。ここはAPI直叩き等でそれを
// 迂回された場合の最終防波堤(拒否はせず切り詰めるだけ・appeal_noteと同型)。
export const MAX_FEEDBACK_BODY_LENGTH = 2000;

/**
 * DISCORD_FEEDBACK_WEBHOOK が未設定なら無言スキップ(fail-soft)。
 * publicリポのため webhook URL はコードに直書きしない — env経由のみ。
 * 通知の成否は呼び出し元(APIルート)のレスポンスに一切影響させない。
 */
export async function notifyDiscordFeedback(params: {
  clientId: string;
  score: number;
  category: string;
  body: string;
}): Promise<void> {
  const url = process.env.DISCORD_FEEDBACK_WEBHOOK;
  if (!url) return;

  const bodyPreview = params.body.slice(0, 200);
  const content = `📮 FB: ${params.clientId} 満足度${params.score}/5 [${
    params.category || "未分類"
  }] ${bodyPreview}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      console.error("[portal/feedback] discord notify failed:", res.status);
    }
  } catch (e) {
    console.error("[portal/feedback] discord notify error:", e);
  }
}
