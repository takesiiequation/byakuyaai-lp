import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getAllClients } from "@/app/_lib/sheets";
import {
  getInvoiceLog,
  getPayments,
  computeBillingStatus,
} from "@/app/_lib/billing";

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const [invoices, payments, clients] = await Promise.all([
      getInvoiceLog(),
      getPayments(),
      getAllClients(),
    ]);

    const entries = computeBillingStatus(
      invoices,
      payments,
      clients.map((c) => ({
        client_id: c.client_id,
        company_name: c.company_name,
        plan: c.plan,
      }))
    );

    return Response.json({
      ok: true,
      data: {
        entries: entries.sort(
          (a, b) => b.対象月.localeCompare(a.対象月) || a.client_id.localeCompare(b.client_id)
        ),
        payments,
      },
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
