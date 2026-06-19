import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { triggerInvoice, triggerReconcile } from "@/app/_lib/billing";

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const { action, client_id, month } = await req.json();

    if (action === "reconcile") {
      const result = await triggerReconcile();
      return Response.json({ ok: true, data: { action, result } });
    }

    if (!client_id) {
      return Response.json(
        { ok: false, error: "client_id is required" },
        { status: 400 }
      );
    }

    if (action === "invoice" || action === "receipt") {
      const result = await triggerInvoice(client_id, action, month);
      return Response.json({ ok: true, data: { action, client_id, result } });
    }

    return Response.json(
      { ok: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
