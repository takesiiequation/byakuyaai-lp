import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getSalesTabs, getSalesTabData } from "@/app/_lib/sales";

// Read-only viewer endpoint for the sales/prospect company list. No POST/PUT —
// this sheet is not editable from the admin UI.
export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  if (!process.env.SALES_SHEET_ID) {
    return Response.json(
      { ok: false, error: "SALES_SHEET_ID が未設定です" },
      { status: 400 }
    );
  }

  try {
    const tabs = await getSalesTabs();
    if (tabs.length === 0) {
      return Response.json({
        ok: true,
        data: { tabs: [], activeTab: "", headers: [], rows: [] },
      });
    }

    const requested = req.nextUrl.searchParams.get("tab") || "";
    const activeTab = tabs.includes(requested) ? requested : tabs[0];
    const { headers, rows } = await getSalesTabData(activeTab);

    return Response.json({
      ok: true,
      data: { tabs, activeTab, headers, rows },
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
