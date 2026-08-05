import { NextRequest, NextResponse } from "next/server";
import { getReviseInfo } from "@/app/_lib/revise";
import { appendFeedback } from "@/app/_lib/sheets";

// POST /api/revise/report — 動画の違和感報告(2026-08-06 岡本発案:「不自然な
// 箇所がありますか?の小さな入口を作って俺に通知」)。修正画面から一言で
// 報告でき、担当者(小濱さん型)が丁寧なメールを書く手間を無くす。
//
// 認可: approval_id自体がケーパビリティ(修正画面を開ける人=報告してよい人)。
// getReviseInfoで実在確認し、実在しないIDは404で弾く。
// 記録: フィードバックタブへ常時追記(耐久)+Discordはbest-effort
// (DISCORD_FEEDBACK_WEBHOOK未設定でも報告自体は失われない)。
const MAX_BODY = 1000;

export async function POST(req: NextRequest) {
  let body: { approval_id?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const approvalId = typeof body?.approval_id === "string" ? body.approval_id.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";
  if (!/^APR-[A-Za-z0-9-]{8,64}$/.test(approvalId)) {
    return NextResponse.json({ ok: false, error: "invalid_approval_id" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ ok: false, error: "empty_body" }, { status: 400 });
  }

  let info;
  try {
    info = await getReviseInfo(approvalId);
  } catch {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (!info || !info.ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const clientName = info.client_name || "";
  const propertyName = info.property_name || "";

  // 耐久記録(フィードバックタブ)。score=0は「違和感報告」の目印
  // (通常FBは1〜5)。失敗しても通知は試みる(fail-soft)。
  let recorded = false;
  try {
    await appendFeedback({
      recorded_at: new Date().toISOString(),
      client_id: clientName || approvalId,
      score: 0,
      category: "動画の違和感報告",
      body: `【${propertyName}】${text}`,
      page: `/revise/${approvalId}`,
    });
    recorded = true;
  } catch (e) {
    console.error("[revise/report] sheet append failed:", e);
  }

  const url = process.env.DISCORD_FEEDBACK_WEBHOOK;
  let notified = false;
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🎥 動画の違和感報告: ${clientName}「${propertyName}」\n${text.slice(0, 400)}\n(${approvalId})`,
        }),
      });
      notified = res.ok;
    } catch (e) {
      console.error("[revise/report] discord notify failed:", e);
    }
  }

  if (!recorded && !notified) {
    return NextResponse.json(
      { ok: false, error: "送信に失敗しました。時間をおいてお試しください" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
