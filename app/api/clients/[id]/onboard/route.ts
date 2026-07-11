import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getClientById, updateClient } from "@/app/_lib/sheets";
import { createClientFolder, createLineDataSheet } from "@/app/_lib/drive";

// line_data_sheet_id is the sole "already onboarded" signal: if present,
// skip re-running (idempotent — see the early-return below).
//
// Folder handling (2026-07-11, admin operability v1): drive_folder_id is now
// a real 契約社リスト column (see _lib/types.ts). If the operator already set
// it via the client editor (per the LINE setup manual, step 3), the LINE
// data sheet is created inside *that* folder instead of a fresh
// auto-created one — matches what the manual tells the operator to do.
// Falls back to the legacy "always create a new folder" behavior (with a
// `warning: "no_folder"` in the response) when it's unset, so this never
// hard-fails just because someone skipped that manual step.
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

    let folderId = client.drive_folder_id || "";
    const usedFallbackFolder = !folderId;
    if (usedFallbackFolder) {
      folderId = await createClientFolder(client.client_id);
    }

    const { sheetId, placedInFolder, folderError } = await createLineDataSheet(
      client.client_name,
      folderId
    );

    const updates: Record<string, string> = { line_data_sheet_id: sheetId };
    // Persist the freshly-created fallback folder so future health checks /
    // "顧客フォルダを開く" links have something to point at.
    if (usedFallbackFolder) updates.drive_folder_id = folderId;
    await updateClient(id, updates);

    let warning: string | undefined;
    if (usedFallbackFolder) warning = "no_folder";
    else if (!placedInFolder) warning = "folder_permission";

    return Response.json({
      ok: true,
      data: {
        client_folder_id: folderId,
        line_data_sheet_id: sheetId,
        ...(warning ? { warning } : {}),
        ...(folderError ? { folder_error: folderError } : {}),
      },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
