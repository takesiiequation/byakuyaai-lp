import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { listMediaFiles, uploadMediaFile } from "@/app/_lib/drive";
import {
  MEDIA_MAX_FILE_SIZE_BYTES,
  MEDIA_MAX_FILE_SIZE_LABEL,
} from "@/app/_lib/types";

type MediaType = "bgm" | "se";

function folderIdFor(type: string): string | undefined {
  if (type === "se") return process.env.SE_FOLDER_ID;
  return process.env.BGM_FOLDER_ID;
}

function labelFor(type: string): string {
  return type === "se" ? "SE_FOLDER_ID" : "BGM_FOLDER_ID";
}

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const type = (req.nextUrl.searchParams.get("type") || "bgm") as MediaType;
  const folderId = folderIdFor(type);
  if (!folderId) {
    return Response.json(
      { ok: false, error: `${labelFor(type)} が未設定です` },
      { status: 400 }
    );
  }

  try {
    const files = await listMediaFiles(folderId);
    return Response.json({ ok: true, data: files });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const type = (req.nextUrl.searchParams.get("type") || "bgm") as MediaType;
  const folderId = folderIdFor(type);
  if (!folderId) {
    return Response.json(
      { ok: false, error: `${labelFor(type)} が未設定です` },
      { status: 400 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: "file が必要です" },
        { status: 400 }
      );
    }
    if (!/\.(mp3|wav)$/i.test(file.name)) {
      return Response.json(
        { ok: false, error: "mp3 / wav のみアップロード可能です" },
        { status: 400 }
      );
    }
    if (file.size > MEDIA_MAX_FILE_SIZE_BYTES) {
      return Response.json(
        {
          ok: false,
          error: `ファイルサイズが大きすぎます(上限${MEDIA_MAX_FILE_SIZE_LABEL})`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadMediaFile(
      folderId,
      file.name,
      file.type || "audio/mpeg",
      buffer
    );
    return Response.json({ ok: true, data: uploaded });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
