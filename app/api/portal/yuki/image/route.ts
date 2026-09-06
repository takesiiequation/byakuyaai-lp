// ユキのデスク 画像の表示(2026-09-06): 会社スコープの認証を通してから、S3(非公開)の署名付きURLへ転送する
//   GET ?key=images/in/xxx.jpg | images/out/xxx.png
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { presignImage, IMAGE_KEY_RE } from "@/app/_lib/yuki_images";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!IMAGE_KEY_RE.test(key)) return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 400 });
  const url = await presignImage(clientId, key, 600);
  if (!url) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=300" } });
}
