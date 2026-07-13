import { NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import {
  countUndispatchedExecFolders,
  createExecFolders,
  encodeBundle,
  MAX_ACTIVE_EXEC_PER_CLIENT,
  quotaState,
} from "@/app/_lib/portalSubmit";

// /portal/submit ステップ1: exec_<uuid12>/{original,maisoku} フォルダを
// GAS標準フォームと同一のルート(PORTAL_SUBMIT_ROOT_FOLDER_ID)配下に
// 実作成し、署名付きトークンを返す。
// ⚠️ 送信が中断されるとこの exec_ フォルダは孤児として残る — 夜間掃除
// cron(NM1RFQy45acrWQEP)は vo_/clip_/revision_manifest のみが対象で
// exec_ には触れない(TODO(実弾後ハードニング): exec_専用GC枝を追加)。
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

  // FIX-3a(最小濫用キャップ・KV不要): 未送信(未dispatch)のexec_フォルダが
  // このclientに溜まりすぎていたら新規発行を止める。カウント自体の失敗は
  // fail-open(このキャップは濫用抑止の補助であり、正常系を巻き込む理由が
  // ない)。本格的なレート制限(Vercel KV/Upstash等)は実弾後ハードニング課題。
  try {
    const activeCount = await countUndispatchedExecFolders(guard.client.client_id);
    if (activeCount >= MAX_ACTIVE_EXEC_PER_CLIENT) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "未送信の依頼が多すぎます。既存の依頼を送信するか、時間をおいて再度お試しください",
        },
        { status: 429 }
      );
    }
  } catch (e) {
    console.error("[portal/submit/init] active exec count check failed (fail-open):", e);
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
