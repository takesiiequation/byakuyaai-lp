import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import {
  createResumableUploadUrl,
  decodeBundle,
  listFolderFiles,
  type DriveFileLite,
} from "@/app/_lib/portalSubmit";
import {
  MAX_PHOTOS,
  checkMaisokuFile,
  checkPhotoFile,
} from "@/app/_lib/portalSubmitShared";

// FIX-3b/c(最小濫用キャップ・KV不要): 1バンドルから発行できる
// アップロードセッションの総数を Drive 列挙による簡易カウントで縛る
// (写真10+マイソク1=11)。本格的なレート制限(Vercel KV/Upstash等)は
// 実弾後ハードニング課題。
const MAX_BUNDLE_UPLOADS = MAX_PHOTOS + 1;

// /portal/submit ステップ2: ファイル1件ごとに Drive resumable upload
// session を発行して返す。ファイル本体はブラウザが session URL へ直接
// PUT する(Vercel 4.5MB制限回避)。
//
// アップロード先フォルダはクライアント入力からは受け取らない —
// init が発行した署名付きトークン内の original/maisoku フォルダIDに
// 限定する(SAが書ける他フォルダへのクロステナント書き込み防止)。

/** パス区切りと制御文字(C0/DEL)を除去し長さを抑える。拡張子は保持。 */
function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  const clean =
    Array.from(base)
      .filter((ch) => {
        const c = ch.charCodeAt(0);
        return c > 31 && c !== 127;
      })
      .join("")
      .trim() || "file";
  return clean.length > 80 ? clean.slice(clean.length - 80) : clean;
}

export async function POST(req: NextRequest) {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }

  let body: {
    token?: unknown;
    target?: unknown;
    name?: unknown;
    mime_type?: unknown;
    size?: unknown;
    index?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }

  const token = typeof body.token === "string" ? body.token : "";
  const bundle = decodeBundle(token);
  if (!bundle || bundle.client_id !== guard.client.client_id) {
    return NextResponse.json(
      { ok: false, error: "セッションの有効期限が切れました。最初からやり直してください" },
      { status: 400 }
    );
  }

  const target = body.target === "maisoku" ? "maisoku" : body.target === "photo" ? "photo" : null;
  const name = typeof body.name === "string" ? body.name : "";
  const mimeType = typeof body.mime_type === "string" ? body.mime_type : "";
  const size = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : -1;
  const index = typeof body.index === "number" && Number.isInteger(body.index) ? body.index : 0;

  if (!target || !name || !mimeType || size < 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }
  if (target === "photo" && (index < 0 || index >= MAX_PHOTOS)) {
    return NextResponse.json(
      { ok: false, error: `写真は最大${MAX_PHOTOS}枚までです` },
      { status: 400 }
    );
  }

  // クライアント側と同一のバリデーションをサーバーでも強制
  const check =
    target === "photo"
      ? checkPhotoFile(name, mimeType, size)
      : checkMaisokuFile(name, mimeType, size);
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
  }

  // FIX-3b: target==='maisoku' は本来 index を使わない(常に0固定)にも
  // 関わらず、これまで index を無視して無制限に発行できる穴だった。
  if (target === "maisoku" && index !== 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 }
    );
  }

  // FIX-3b/c(最小濫用キャップ): 既存ファイル数をDrive列挙で確認し、
  // (b)マイソクは1バンドル1件のみ (c)バンドル全体でMAX_BUNDLE_UPLOADS
  // 件まで、を強制する。
  let existingPhotos: DriveFileLite[];
  let existingMaisoku: DriveFileLite[];
  try {
    [existingPhotos, existingMaisoku] = await Promise.all([
      listFolderFiles(bundle.original_folder_id),
      listFolderFiles(bundle.maisoku_folder_id),
    ]);
  } catch (e) {
    console.error("[portal/submit/upload-url] abuse-cap check failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "アップロード準備に失敗しました。時間をおいて再度お試しください",
      },
      { status: 500 }
    );
  }
  if (target === "maisoku" && existingMaisoku.length > 0) {
    return NextResponse.json(
      { ok: false, error: "マイソクは1件のみアップロードできます" },
      { status: 409 }
    );
  }
  if (existingPhotos.length + existingMaisoku.length >= MAX_BUNDLE_UPLOADS) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "このリクエストのアップロード上限に達しました。最初からやり直してください",
      },
      { status: 429 }
    );
  }

  // 写真は連番プレフィックスで順序を固定(Driveのfiles.listはorderBy未指定
  // =順序不定のため・仕様書(3))。Directorが並べ替えるので影響は限定的だが
  // 決定論に寄せておく。
  const finalName =
    target === "photo"
      ? `${String(index + 1).padStart(2, "0")}_${sanitizeName(name)}`
      : `maisoku_${sanitizeName(name)}`;
  const folderId =
    target === "photo" ? bundle.original_folder_id : bundle.maisoku_folder_id;

  try {
    const uploadUrl = await createResumableUploadUrl({
      folderId,
      name: finalName,
      mimeType,
      size,
      origin: req.headers.get("origin"),
    });
    return NextResponse.json({ ok: true, upload_url: uploadUrl });
  } catch (e) {
    console.error("[portal/submit/upload-url] session failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "アップロード準備に失敗しました。時間をおいて再度お試しください",
      },
      { status: 500 }
    );
  }
}
