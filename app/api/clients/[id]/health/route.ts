import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getClientById } from "@/app/_lib/sheets";
import { checkClientHealth } from "@/app/_lib/health";

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
    const result = await checkClientHealth(client);
    return Response.json({ ok: true, data: result });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
