import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { deleteMediaFile } from "@/app/_lib/drive";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteMediaFile(id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
