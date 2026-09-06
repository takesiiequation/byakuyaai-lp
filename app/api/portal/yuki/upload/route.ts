// ユキのデスク 画像のお預かり(2026-09-06): お客様が添付した画像を workspace/{client}/images/in/ に置き、キーを返す
//   画面側で長辺1600pxに縮めてから送る(Vercelの本文上限4.5MBの内側)。中身の先頭バイトで jpg/png/webp を判定
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { storeUpload } from "@/app/_lib/yuki_images";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  let file: File | null = null;
  try { const fd = await req.formData(); const f = fd.get("file"); if (f instanceof File) file = f; } catch { return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 }); }
  if (!file) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  if (file.size > 6 * 1024 * 1024) return NextResponse.json({ ok: false, error: "画像が大きすぎます(6MBまで)" }, { status: 413 });
  const r = await storeUpload(clientId, Buffer.from(await file.arrayBuffer()));
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error === "type" ? "JPEG / PNG / WebP の画像だけ添付できます" : r.error === "size" ? "画像が大きすぎます" : "保存に失敗しました" }, { status: 400 });
  return NextResponse.json({ ok: true, key: r.key });
}
