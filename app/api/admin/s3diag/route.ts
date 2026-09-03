import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/_lib/auth";
import { s3Diag } from "@/app/_lib/props_store";

// 本番のS3疎通診断(2026-09-04): Vercelに入れた鍵で記憶ノート/レート制限/propsのS3が本当に動くかを、
// 鍵の値を出さずに確認する。admin鍵(x-api-key)またはadminセッション必須。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const r = await s3Diag();
  return NextResponse.json({ ok: true, ...r });
}
