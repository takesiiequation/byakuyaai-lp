import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import { APPROVAL_ID_RE } from "@/app/_lib/revise";
import {
  APPROVAL_ACTIONS,
  callApprovalConfirm,
  verifyPendingApproval,
  type ApprovalActionKind,
} from "@/app/_lib/approvalAction";

// /portal の制作状況一覧、pending_approval行の「✅ 投稿を承認」「却下」ボタン。
// 承認メールのボタンからしか承認/却下できなかった盲点を埋める — 実体は
// メールの<form>と同じ n8n webhook 呼び出し(app/_lib/approvalAction.ts参照)。
//
// 二段防御: (1) ここではセッションの client_id 所有下の 制作状況 行
// (pending_approval のみ)であることを verifyPendingApproval で確認してから
// でないと n8n には一切POSTしない(他社の approval_id を叩けない・
// stale ページからの誤操作を拒否)。(2) 実際の二重投稿ガードは n8n の
// "Decide" コードノード側(承認待ちシートの status を最初の1件だけ
// atomic に "processing"/"rejected" へ倒す)に委ねる — ここでは車輪の
// 再発明をしない。
export async function POST(req: NextRequest) {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }

  let body: { approvalId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }

  const approvalId = body?.approvalId;
  if (typeof approvalId !== "string" || !APPROVAL_ID_RE.test(approvalId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_approval_id" },
      { status: 400 }
    );
  }

  const action = body?.action;
  if (
    typeof action !== "string" ||
    !(APPROVAL_ACTIONS as readonly string[]).includes(action)
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_action" },
      { status: 400 }
    );
  }

  const owns = await verifyPendingApproval(guard.client.client_id, approvalId);
  if (!owns) {
    return NextResponse.json(
      {
        ok: false,
        error: "この投稿は操作できません(既に処理済みか、対象が見つかりません)",
      },
      { status: 409 }
    );
  }

  const result = await callApprovalConfirm(
    approvalId,
    action as ApprovalActionKind
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
