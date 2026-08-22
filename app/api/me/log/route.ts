import { NextRequest } from "next/server";
import { isMeAuthed } from "@/app/_lib/meAuth";
import { readLog, writeLog, type LogState } from "@/app/_lib/meStore";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isMeAuthed())) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const log = await readLog();
    return Response.json({ ok: true, ...log });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/** Upsert. The body carries only the days the client actually changed, so a
 * device that has been offline for a week can never wipe the days it never
 * saw (meStore.writeLog leaves absent dates untouched). */
export async function PUT(req: NextRequest) {
  if (!(await isMeAuthed())) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as LogState | null;
  if (!body || typeof body !== "object" || !body.days || typeof body.days !== "object") {
    return Response.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  const n = Object.keys(body.days).length;
  if (n > 400) {
    return Response.json({ ok: false, error: "too many days" }, { status: 400 });
  }
  try {
    const written = await writeLog(body);
    return Response.json({ ok: true, written });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
