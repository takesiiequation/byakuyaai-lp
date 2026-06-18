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
    delete body.client_id;
    await updateClient(id, body);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
