import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getClientById, updateClient } from "@/app/_lib/sheets";
import { createClientFolder, createLineDataSheet } from "@/app/_lib/drive";

// NOTE: the real "契約社リスト" sheet has no client_folder_id column (that was
// a leftover from the old schema), so the Drive folder id can't be persisted
// there for idempotency. line_data_sheet_id IS a real column, so it's used as
// the sole "already onboarded" signal: if present, skip re-running (a fresh
// Drive folder is created every time onboarding actually runs, then the LINE
// data sheet is created inside it).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const { id } = await params;

  try {
    const client = await getClientById(id);
    if (!client) {
      return Response.json({ ok: false, error: "Client not found" }, { status: 404 });
    }

    if (client.line_data_sheet_id) {
      return Response.json({
        ok: true,
        data: {
          line_data_sheet_id: client.line_data_sheet_id,
          sheet_skipped: "既にLINEデータシートが存在します",
        },
      });
    }

    const folderId = await createClientFolder(client.client_id);
    const sheetId = await createLineDataSheet(client.client_name, folderId);
    await updateClient(id, { line_data_sheet_id: sheetId });

    return Response.json({
      ok: true,
      data: { client_folder_id: folderId, line_data_sheet_id: sheetId },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
