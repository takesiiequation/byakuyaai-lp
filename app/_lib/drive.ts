import { google } from "googleapis";
import { Readable } from "stream";

const ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID;

// 2026-07-15: このモジュールは元々 GOOGLE_SERVICE_ACCOUNT_KEY(SA)で動いて
// いたが、SA は 0 クォータのマイドライブしか持たず、
// createLineDataSheet() 冒頭の sheets().spreadsheets.create()(親フォルダ
// 未指定 = 呼び出し主体自身のマイドライブに新規作成)が
// storageQuotaExceeded(403 "The caller does not have permission")で
// 恒久的に失敗していた — admin「セットアップ実行」が100%失敗していた
// 根本原因。portalSubmit.ts が2026-07-14に導入した岡本本人のOAuth
// (案C)に揃える。
//
// スコープ裏取り: リフレッシュトークンのスコープは auth/drive のみだが、
// Google公式「OAuth 2.0 Scopes for Google APIs」
// (developers.google.com/identity/protocols/oauth2/scopes)の Sheets API
// (v4) セクションに https://www.googleapis.com/auth/drive が正式スコープ
// として明記されている — spreadsheets.create / values.batchUpdate とも
// auth/drive のみで動く(spreadsheets 専用スコープの追加取得は不要)。
//
// fail-closed: 3 env のいずれかが欠けたら明確な理由付きでthrowする。
// GOOGLE_SERVICE_ACCOUNT_KEY への暗黙フォールバックはしない(同じ403を
// 黙って再現する事故を構造的に禁止する)。契約社シートの読み書き
// (sheets.ts等)やポータル系(portalSubmit.ts)は無関係・SAのまま不変。
function getAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN is not set " +
        "— Drive/Sheets保存はSAではなく岡本本人のOAuthに切替済み(案C・2026-07-14 portalSubmit.ts / " +
        "2026-07-15 drive.ts)。SAへの暗黙フォールバックはしない(fail-closed)。取得手順は .env.example 参照。"
    );
  }
  const client = new google.auth.OAuth2({ clientId, clientSecret });
  client.setCredentials({ refresh_token: refreshToken });
  return client;
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

export interface CreateLineDataSheetResult {
  sheetId: string;
  /** True iff folderId was given AND the sheet was successfully moved into
   * it. False (with folderError set) when folderId was given but the move
   * failed — e.g. 岡本本人のOAuthアカウントがそのフォルダにEditor共有され
   * ていない(共有ドライブ配下など)場合(see the LINE setup manual, step 3).
   * The sheet still gets created either way (fail-soft): it just stays
   * wherever spreadsheets.create() put it (岡本本人のマイドライブ直下)。 */
  placedInFolder: boolean;
  folderError?: string;
}

export async function createLineDataSheet(
  companyName: string,
  folderId?: string
): Promise<CreateLineDataSheetResult> {
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

  let placedInFolder = false;
  let folderError: string | undefined;
  if (folderId) {
    try {
      await drive().files.update({
        fileId: sheetId,
        addParents: folderId,
        removeParents: "root",
        fields: "id",
      });
      placedInFolder = true;
    } catch (e) {
      folderError = String(e);
      // Fail-soft: leave the sheet where spreadsheets.create() put it
      // (岡本本人のマイドライブ直下) rather than failing onboarding.
    }
  }

  return { sheetId, placedInFolder, folderError };
}

// --- Module B: BGM/SE media library --------------------------------------
// Reuses the same OAuth (岡本本人・案C) client used above. BGM_FOLDER_ID /
// SE_FOLDER_ID must be folders 岡本 can write to (same operational
// requirement DRIVE_ROOT_FOLDER_ID has). Uploaded files are made
// link-readable ("anyone with
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
