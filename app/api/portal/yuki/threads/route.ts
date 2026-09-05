// ユキのデスク スレッドAPI(R2.5): 一覧(GET)・片付ける/戻す(POST {thread_id, archived})・1本の会話(GET ?thread_id=)
import { NextRequest, NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";
import { isFlagOn } from "@/app/_lib/portalSubmitShared";
import { deskVisibleFor } from "@/app/_lib/deskRelease";
import { listThreads, readThread, archiveThread } from "@/app/_lib/yuki_cp";

export const maxDuration = 30;

async function gate() {
  const clientId = await getPortalClientId();
  if (!clientId) return { err: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  const client = await getClientById(clientId);
  if (!client || !deskVisibleFor(client.plan) || !isFlagOn(client.portal_enabled) || !isFlagOn(client.workspace_enabled)) {
    return { err: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { clientId };
}

export async function GET(req: NextRequest) {
  const g = await gate(); if ("err" in g) return g.err;
  const threadId = req.nextUrl.searchParams.get("thread_id");
  try {
    if (threadId) return NextResponse.json({ ok: true, messages: (await readThread(g.clientId!, threadId)).map((m) => ({ role: m.role, content: m.content })) });
    return NextResponse.json({ ok: true, threads: await listThreads(g.clientId!) });
  } catch { return NextResponse.json({ ok: true, threads: [], messages: [], degraded: true }); }
}

export async function POST(req: NextRequest) {
  const g = await gate(); if ("err" in g) return g.err;
  let body: { thread_id?: unknown; archived?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 }); }
  const threadId = typeof body.thread_id === "string" ? body.thread_id : "";
  const archived = body.archived !== false;
  const ok = threadId ? await archiveThread(g.clientId!, threadId, archived) : false;
  return NextResponse.json({ ok });
}
