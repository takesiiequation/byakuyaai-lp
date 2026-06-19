import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { addPayment, triggerReconcile } from "@/app/_lib/billing";

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { client_id, month, amount, date, memo } = body;

    if (!client_id || !month || !amount || !date) {
      return Response.json(
        { ok: false, error: "client_id, month, amount, date are required" },
        { status: 400 }
      );
    }

    await addPayment({
      入金日: date,
      client_id,
      対象月: month,
      入金額: Number(amount),
      メモ: memo || "",
    });

    let reconcileResult = "";
    try {
      reconcileResult = await triggerReconcile();
    } catch {
      reconcileResult = "reconcile_skipped";
    }

    return Response.json({
      ok: true,
      data: { recorded: true, reconcile: reconcileResult },
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
