import { NextRequest, NextResponse } from "next/server";
import { APPROVAL_ID_RE } from "@/app/_lib/revise";
import { loadHistory } from "@/app/_lib/companion";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const approvalId = req.nextUrl.searchParams.get("approvalId") ?? "";
  if (!APPROVAL_ID_RE.test(approvalId)) {
    return NextResponse.json({ ok: false, error: "invalid_approval_id" }, { status: 400 });
  }
  const messages = await loadHistory(approvalId);
  return NextResponse.json({ ok: true, messages });
}
