import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getClientById, updateClient } from "@/app/_lib/sheets";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const client = await getClientById(id);
    if (!client) {
      return Response.json(
        { ok: false, error: "Not found" },
        { status: 404 }
      );
    }
    return Response.json({ ok: true, data: client });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    const body = await req.json();
    // client_id/secret_key are immutable via the GUI; used_this_month,
    // quota_reset, next_post_slot are system-managed (written by the video
    // pipeline / n8n), not by this admin form — strip all of them
    // server-side so a UI bug can't smuggle a write through.
    delete body.client_id;
    delete body.secret_key;
    delete body.used_this_month;
    delete body.quota_reset;
    delete body.next_post_slot;
    await updateClient(id, body);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
