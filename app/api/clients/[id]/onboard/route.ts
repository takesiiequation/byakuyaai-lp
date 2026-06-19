import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getClientById, updateClient } from "@/app/_lib/sheets";
import { createClientFolder, createLineDataSheet } from "@/app/_lib/drive";

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

    const results: Record<string, string> = {};

    if (client.client_folder_id) {
      results.client_folder_id = client.client_folder_id;
      results.folder_skipped = "既にフォルダが存在します";
    } else {
      const folderId = await createClientFolder(client.client_id);
      results.client_folder_id = folderId;
      await updateClient(id, { client_folder_id: folderId });
    }

    if (client.line_data_sheet_id) {
      results.line_data_sheet_id = client.line_data_sheet_id;
      results.sheet_skipped = "既にLINEデータシートが存在します";
    } else {
      const sheetId = await createLineDataSheet(
        client.company_name,
        results.client_folder_id
      );
      results.line_data_sheet_id = sheetId;
      await updateClient(id, { line_data_sheet_id: sheetId });
    }

    return Response.json({ ok: true, data: results });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
