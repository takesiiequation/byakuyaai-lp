import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import { markRowSold } from "@/app/_lib/portal";

// POST /api/portal/status/sold — 成約報告の入口(2026-08-01 岡本発案、
// 2026-08-02 仕様訂正)。目的は「LINEお問い合わせAIが成約済み物件への
// 内見予約等を『そちらの物件は成約済みです』と案内して弾く」ためのデータ
// 記録。SNS投稿の削除はしない・管理者への通知もしない(岡本対応ゼロが要件)。
// LINE Bot側がこのsoldステータスを参照する。
//
// 防御は hide と同型の二段: requirePortalClient(セッション+portal_enabled)
// + markRowSold内部の exec_id/client_id/対象ステータス再検証。
export async function POST(req: NextRequest) {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }

  let body: { exec_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }

  const execId = body?.exec_id;
  if (typeof execId !== "string" || !execId) {
    return NextResponse.json(
      { ok: false, error: "invalid_exec_id" },
      { status: 400 }
    );
  }

  const result = await markRowSold(guard.client.client_id, execId);

  if (result.result === "ok") {
    return NextResponse.json({ ok: true });
  }
  if (result.result === "not_found") {
    return NextResponse.json(
      { ok: false, error: "対象の動画が見つかりません" },
      { status: 404 }
    );
  }
  return NextResponse.json(
    { ok: false, error: "処理に失敗しました。時間をおいて再度お試しください" },
    { status: 500 }
  );
}
