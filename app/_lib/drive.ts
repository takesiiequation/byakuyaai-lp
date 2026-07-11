import { google } from "googleapis";
import { Readable } from "stream";

const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

function drive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export async function createClientFolder(clientId: string): Promise<string> {
  if (!ROOT_FOLDER_ID) throw new Error("DRIVE_ROOT_FOLDER_ID is not set");

  const res = await drive().files.create({
    requestBody: {
      name: clientId,
      mimeType: "application/vnd.google-apps.folder",
      parents: [ROOT_FOLDER_ID],
    },
    fields: "id",
  });

  return res.data.id!;
}

export async function createLineDataSheet(
  companyName: string,
  folderId?: string
): Promise<string> {
  const res = await sheets().spreadsheets.create({
    requestBody: {
      properties: { title: `${companyName} LINEデータ` },
      sheets: [
        { properties: { title: "LINEナレッジ", index: 0 } },
        { properties: { title: "LINE会話ログ", index: 1 } },
        { properties: { title: "内見予約", index: 2 } },
      ],
    },
  });

  const sheetId = res.data.spreadsheetId!;

  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        {
          range: "LINEナレッジ!A1:E1",
          values: [["client_id", "category", "title", "content", "enabled"]],
        },
        {
          range: "LINE会話ログ!A1:D1",
          values: [["user_id", "role", "text", "ts"]],
        },
        {
          range: "内見予約!A1:L1",
          values: [[
            "booking_id", "client_id", "user_id", "name", "phone",
            "property", "slot1", "slot2", "status", "decided_slot",
            "decided_at", "ts",
          ]],
        },
      ],
    },
  });

  if (folderId) {
    await drive().files.update({
      fileId: sheetId,
      addParents: folderId,
      removeParents: "root",
      fields: "id",
    });
  }

  return sheetId;
}

// --- Module B: BGM/SE media library --------------------------------------
// Reuses the same broad-scope (drive + spreadsheets) service-account client
// used above. The service account must be shared as Editor on
// BGM_FOLDER_ID / SE_FOLDER_ID, same operational requirement as
// DRIVE_ROOT_FOLDER_ID. Uploaded files are made link-readable ("anyone with
// the link") so the admin UI can preview them via a plain
// `https://drive.google.com/uc?export=download&id=<id>` URL without proxying
// playback through an authenticated route.
export interface MediaFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  mimeType: string;
}

export async function listMediaFiles(folderId: string): Promise<MediaFile[]> {
  const res = await drive().files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, size, createdTime, mimeType)",
    orderBy: "createdTime desc",
    pageSize: 200,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id ?? "",
    name: f.name ?? "",
    size: Number(f.size) || 0,
    createdTime: f.createdTime ?? "",
    mimeType: f.mimeType ?? "",
  }));
}

export async function uploadMediaFile(
  folderId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<MediaFile> {
  const res = await drive().files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, name, size, createdTime, mimeType",
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error("Drive did not return a file id");

  // Make it link-readable so <audio src="uc?export=download&id=..."> works.
  await drive().permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    id: fileId,
    name: res.data.name ?? filename,
    size: Number(res.data.size) || buffer.length,
    createdTime: res.data.createdTime ?? "",
    mimeType: res.data.mimeType ?? mimeType,
  };
}

export async function deleteMediaFile(fileId: string): Promise<void> {
  await drive().files.delete({ fileId });
}
