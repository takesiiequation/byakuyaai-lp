import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import { markRowSold } from "@/app/_lib/portal";

// POST /api/portal/status/sold — 成約報告の入口(2026-08-01 岡本発案)。
// 投稿済み/納品済み行の「成約しました」ボタンから exec_id を受け、
// 制作状況のstatusを'sold'へ更新し、Discordで管理者へSNS投稿の削除確認を
// 依頼する。杉田コンプラ要件「成約時削除」の顧客セルフサービス窓口。
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
    // Discord通知はfail-soft: 通知が死んでもシート記録(=正)は済んでいる。
    // 未通知のままだと削除手配が漏れるため、通知失敗はサーバーログに残す。
    const url = process.env.DISCORD_FEEDBACK_WEBHOOK;
    if (url) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🎉 成約報告: ${result.clientName}(${guard.client.client_id})「${result.propertyName}」— SNS投稿の削除確認をお願いします(exec_id: ${execId})`,
          }),
        });
        if (!res.ok) {
          console.error("[portal/sold] discord notify failed:", res.status);
        }
      } catch (e) {
        console.error("[portal/sold] discord notify error:", e);
      }
    } else {
      console.error("[portal/sold] DISCORD_FEEDBACK_WEBHOOK unset — 成約通知未送");
    }
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
