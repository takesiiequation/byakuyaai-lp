import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import { hideProductionRow } from "@/app/_lib/portal";

// POST /api/portal/status/hide — 岡本発案(2026-07-27):「失敗しましたの欄が
// 何個もあって邪魔、消せるようにできない?」への対応。制作状況一覧の
// failed/revise_failed行だけを対象に、シートのI列(hidden)へ'true'を
// 立てて一覧から除外する(データ自体は消さない・監査用に行はシートに残す)。
//
// 二段防御: requirePortalClient でセッション+portal_enabledを確認した上、
// hideProductionRow 内部でも「exec_id一致 かつ client_idがセッションの
// clientIdと一致 かつ ステータスが失敗系」を再検証してから書き込む
// (他社の行や失敗系以外の行を誤って隠す経路を作らない)。
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

  const result = await hideProductionRow(guard.client.client_id, execId);

  if (result === "ok") {
    return NextResponse.json({ ok: true });
  }
  if (result === "not_found") {
    return NextResponse.json(
      { ok: false, error: "対象の行が見つかりません" },
      { status: 404 }
    );
  }
  // fail-soft: シート障害はここで吸収し、例外を漏らさず500で返す
  return NextResponse.json(
    { ok: false, error: "処理に失敗しました。時間をおいて再度お試しください" },
    { status: 500 }
  );
}
