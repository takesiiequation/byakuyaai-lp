import { NextRequest, NextResponse } from "next/server";
import { APPROVAL_ID_RE, getReviseInfo } from "@/app/_lib/revise";

export async function POST(req: NextRequest) {
  let body: { approvalId?: unknown };
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

  const info = await getReviseInfo(approvalId);
  return NextResponse.json(info, { status: info.ok ? 200 : 400 });
}
