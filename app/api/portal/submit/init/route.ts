import { NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import {
  createExecFolders,
  encodeBundle,
  quotaState,
} from "@/app/_lib/portalSubmit";

// /portal/submit ステップ1: exec_<uuid12>/{original,maisoku} フォルダを
// GAS標準フォームと同一のルート(PORTAL_SUBMIT_ROOT_FOLDER_ID)配下に
// 実作成し、署名付きトークンを返す。ここで作られたフォルダは送信が
// 中断されても夜間掃除cron(素材7日保持)が回収する=可逆。
//
// クォータの事前チェックもここで行う(罠(4)-5)。正本はn8n側の
// 認証+回数制限ノードであり、これはUX用の早期拒否にすぎない。

export async function POST() {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }

  const qs = quotaState(guard.client);
  if (qs === "not_configured") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "動画作成の上限が未設定のためご利用いただけません。担当者までご連絡ください",
      },
      { status: 409 }
    );
  }
  if (qs === "exceeded") {
    return NextResponse.json(
      {
        ok: false,
        error: "今月の作成上限に達しています。翌月まで新しい依頼はできません",
      },
      { status: 409 }
    );
  }

  try {
    const bundle = await createExecFolders(guard.client.client_id);
    return NextResponse.json({
      ok: true,
      token: encodeBundle(bundle),
      exec_id: bundle.exec_id,
    });
  } catch (e) {
    console.error("[portal/submit/init] exec folder creation failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          "アップロード準備に失敗しました。時間をおいて再度お試しください",
      },
      { status: 500 }
    );
  }
}
