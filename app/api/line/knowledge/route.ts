import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getClientById } from "@/app/_lib/sheets";
import { getLineKnowledge, updateLineKnowledge } from "@/app/_lib/lineKnowledge";

// clientId -> line_data_sheet_id is always resolved server-side from the
// 契約社リスト sheet, never accepted from the request body/query directly.
// This is the whole point of routing through clientId instead of a raw
// spreadsheet id: a client of this API can only ever touch the sheet already
// tied to that client_id (権限昇格防止).
async function resolveSheetId(
  clientId: string
): Promise<{ sheetId: string } | { error: string; status: number }> {
  if (!clientId) return { error: "clientId が必要です", status: 400 };

  const client = await getClientById(clientId);
  if (!client) return { error: "顧客が見つかりません", status: 404 };

  if (!client.line_data_sheet_id) {
    return { error: "この顧客はLINEデータシート未接続です", status: 400 };
  }

  return { sheetId: client.line_data_sheet_id };
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const clientId = req.nextUrl.searchParams.get("clientId") || "";

  try {
    const resolved = await resolveSheetId(clientId);
    if ("error" in resolved) {
      return Response.json(
        { ok: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    const { headers, rows } = await getLineKnowledge(resolved.sheetId);
    return Response.json({ ok: true, data: { headers, rows } });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const clientId = String(body?.clientId || "");
    const incomingRows = body?.rows;

    if (!Array.isArray(incomingRows)) {
      return Response.json(
        { ok: false, error: "rows が必要です" },
        { status: 400 }
      );
    }

    const resolved = await resolveSheetId(clientId);
    if ("error" in resolved) {
      return Response.json(
        { ok: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    // Header row is read-only in the UI and is never trusted from the
    // client — always re-read fresh from the sheet just before writing.
    const current = await getLineKnowledge(resolved.sheetId);
    if (current.headers.length === 0) {
      return Response.json(
        { ok: false, error: "ナレッジタブが見つかりません" },
        { status: 400 }
      );
    }

    const width = current.headers.length;
    const rows: string[][] = incomingRows.map((r) => {
      const row = (Array.isArray(r) ? r : [])
        .slice(0, width)
        .map((c) => String(c ?? ""));
      while (row.length < width) row.push("");
      return row;
    });

    await updateLineKnowledge(resolved.sheetId, current.headers, rows);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
