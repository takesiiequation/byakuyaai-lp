import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import { appendFeedback } from "@/app/_lib/sheets";
import {
  FEEDBACK_CATEGORIES,
  MAX_FEEDBACK_BODY_LENGTH,
  notifyDiscordFeedback,
} from "@/app/_lib/portalFeedback";

// POST /api/portal/feedback — ポータル「ご意見・ご要望」画面(岡本発案)の
// 送信先。目的は2つ: ①不満の早期検知(解約前に拾う) ②好評の声の収集
// (営業・LP転用の証言資産)。
//
// fail-soft設計: シート追記/Discord通知が失敗しても顧客には常に
// ok:true(=「ありがとうございます」表示)を返す。フィードバック機能
// 自体が顧客体験を壊す(500を見せる)のは本末転倒 — 失敗はconsole.error
// にだけ残し、後で気づける形にする。
//
// 唯一のハード拒否は認証(requirePortalClient経由の401/403)とscore不正
// (400)。「誰が」「何段階で」評価したかはデータの根幹なのでここだけは
// 曖昧なまま書き込まない。category/bodyは任意項目なので不正値は拒否
// せず丸める(portalSubmitのappeal_noteと同型のfail-soft方針)。

export async function POST(req: NextRequest) {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }
  const client = guard.client;

  let payload: {
    score?: unknown;
    category?: unknown;
    body?: unknown;
    page?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }

  const score =
    typeof payload.score === "number" ? Math.round(payload.score) : NaN;
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return NextResponse.json(
      { ok: false, error: "満足度を選択してください" },
      { status: 400 }
    );
  }

  const categoryRaw = typeof payload.category === "string" ? payload.category : "";
  const category = (FEEDBACK_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? categoryRaw
    : "";

  const body =
    typeof payload.body === "string"
      ? payload.body.trim().slice(0, MAX_FEEDBACK_BODY_LENGTH)
      : "";

  const page =
    typeof payload.page === "string" && payload.page.trim()
      ? payload.page.trim().slice(0, 200)
      : "/portal/feedback";

  try {
    await appendFeedback({
      recorded_at: new Date().toISOString(),
      client_id: client.client_id,
      score,
      category,
      body,
      page,
    });
  } catch (e) {
    // fail-soft: シートタブ未作成/権限エラー等でも顧客体験は壊さない
    console.error("[portal/feedback] sheet append failed:", e);
  }

  // Discord通知も同じ理由でレスポンスをブロックしない失敗許容(env未設定
  // なら無言スキップ・notifyDiscordFeedback内部でtry/catch済み)。
  await notifyDiscordFeedback({ clientId: client.client_id, score, category, body });

  return NextResponse.json({ ok: true });
}
