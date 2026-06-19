import { google } from "googleapis";

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
          range: "LINEナレッジ!A1:B1",
          values: [["content", "enabled"]],
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
