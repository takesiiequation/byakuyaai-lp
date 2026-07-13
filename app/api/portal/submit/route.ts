import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";
import {
  buildSubmitPayload,
  decodeBundle,
  dispatchSubmit,
  getFileMeta,
  isSubmitEnabled,
  maskPayload,
  payloadViolations,
  quotaState,
} from "@/app/_lib/portalSubmit";
import {
  ASPECT_RATIOS,
  DEAL_TYPES,
  MAX_PHOTOS,
  type AspectRatio,
  type DealType,
} from "@/app/_lib/portalSubmitShared";

// /portal/submit ステップ3(最終): ペイロード組み立て→送信ゲート。
//
// - secret_key は契約社シートから取得(顧客は鍵を入力しない・鍵は
//   ブラウザに一切渡らない)。trim のみ・正規化なし(罠(4)-4)。
// - 送信前に Drive の実在検証(FIX-1): claim された各 file_id を
//   files.get で個別に強整合確認する(files.list の列挙による突合は
//   書き込み直後のインデックスラグを受け、正当な送信を409で誤拒否する
//   事故があったため廃止 — files.get はID参照でラグを受けない)。
//   写真は元フォルダ配下・非trash・image/*であること、maisoku_file_id は
//   バンドルの maisoku フォルダ内に実在すること(任意fileId注入の防止)
//   をそれぞれ assert する。
// - PORTAL_SUBMIT_ENABLED !== "true" の間は webhook へ一切 fetch せず、
//   組み立て済みペイロード(secret_keyはマスク)を返す=ドライラン
//   (仕様書(5)-①送信ゲート方式)。
// - n8n webhook は responseMode: onReceived のため 200 = 受理ではない
//   (罠(4)-3)。invalid_secret_key / quota_exceeded でも 200 が返る —
//   成否の確定はメール通知とマイページ一覧(制作状況シート)で行う。

const FILE_ID_RE = /^[A-Za-z0-9_-]{10,}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(req: NextRequest) {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status }
    );
  }
  const client = guard.client;

  let body: {
    token?: unknown;
    maisoku_file_id?: unknown;
    photo_file_ids?: unknown;
    aspect_ratio?: unknown;
    deal_type?: unknown;
    email?: unknown;
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
  if (!bundle || bundle.client_id !== client.client_id) {
    return NextResponse.json(
      { ok: false, error: "セッションの有効期限が切れました。最初からやり直してください" },
      { status: 400 }
    );
  }

  // --- 入力バリデーション ---
  const maisokuFileId =
    typeof body.maisoku_file_id === "string" ? body.maisoku_file_id.trim() : "";
  if (!FILE_ID_RE.test(maisokuFileId)) {
    return NextResponse.json(
      { ok: false, error: "マイソクのアップロードが確認できません。最初からやり直してください" },
      { status: 400 }
    );
  }

  const photoIdsRaw = Array.isArray(body.photo_file_ids) ? body.photo_file_ids : null;
  const photoFileIds = (photoIdsRaw ?? [])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim());
  if (
    !photoIdsRaw ||
    photoFileIds.length < 1 ||
    photoFileIds.length > MAX_PHOTOS ||
    photoFileIds.some((id) => !FILE_ID_RE.test(id)) ||
    new Set(photoFileIds).size !== photoFileIds.length
  ) {
    return NextResponse.json(
      { ok: false, error: `写真は1〜${MAX_PHOTOS}枚でアップロードしてください` },
      { status: 400 }
    );
  }

  const aspectRatio = body.aspect_ratio;
  if (
    typeof aspectRatio !== "string" ||
    !(ASPECT_RATIOS as readonly string[]).includes(aspectRatio)
  ) {
    return NextResponse.json(
      { ok: false, error: "アスペクト比の指定が不正です" },
      { status: 400 }
    );
  }

  const dealType = body.deal_type;
  if (
    typeof dealType !== "string" ||
    !(DEAL_TYPES as readonly string[]).includes(dealType)
  ) {
    return NextResponse.json(
      { ok: false, error: "取引種別の指定が不正です" },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!EMAIL_RE.test(email)) {
    // email 空でもWFは止まらないが顧客通知が全て消える(罠(4)-7)ため必須化
    return NextResponse.json(
      { ok: false, error: "通知メールアドレスを正しく入力してください" },
      { status: 400 }
    );
  }

  // secret_key 空 = シート設定漏れ。n8nに投げても invalid_secret_key に
  // なるだけなので手前で止める(罠(4)-7と同型の静かな事故防止)。
  if (!(client.secret_key || "").trim()) {
    return NextResponse.json(
      { ok: false, error: "アカウント設定が未完了です(認証キー未設定)。担当者までご連絡ください" },
      { status: 409 }
    );
  }

  // クォータ再チェック(init後にアップロードで時間が経っているため)
  const qs = quotaState(client);
  if (qs !== "ok") {
    return NextResponse.json(
      {
        ok: false,
        error:
          qs === "exceeded"
            ? "今月の作成上限に達しています。翌月まで新しい依頼はできません"
            : "動画作成の上限が未設定のためご利用いただけません。担当者までご連絡ください",
      },
      { status: 409 }
    );
  }

  // --- Drive 実在検証(仕様書(5)-①の自動assert・FIX-1) ---
  let photoCount = 0;
  try {
    const [photoMetas, maisokuMeta] = await Promise.all([
      Promise.all(photoFileIds.map((id) => getFileMeta(id))),
      getFileMeta(maisokuFileId),
    ]);
    photoCount = photoFileIds.length;

    // TODO(実弾後ハードニング): ここでのmimeType判定はDrive側メタなので
    // ブラウザ申告のContent-Typeより信頼できるが、実size・実バイナリの
    // 中身(SVG/HEIC偽装等)までは見ていない。下流(imgbb/Gemini)互換の
    // 最終防御としては、Driveメタから実size等を再判定する枝を追加する。
    const photosOk = photoMetas.every(
      (m) =>
        m !== null &&
        m.trashed === false &&
        m.parents.includes(bundle.original_folder_id) &&
        m.mimeType.startsWith("image/")
    );
    if (!photosOk) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "写真のアップロード内容を確認できませんでした。最初からやり直してください",
        },
        { status: 409 }
      );
    }

    const maisokuOk =
      maisokuMeta !== null &&
      maisokuMeta.trashed === false &&
      maisokuMeta.parents.includes(bundle.maisoku_folder_id);
    if (!maisokuOk) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "マイソクのアップロード内容を確認できませんでした。最初からやり直してください",
        },
        { status: 409 }
      );
    }
  } catch (e) {
    console.error("[portal/submit] drive verification failed:", e);
    return NextResponse.json(
      { ok: false, error: "アップロード内容の確認に失敗しました。時間をおいて再度お試しください" },
      { status: 500 }
    );
  }

  // --- ペイロード組み立て(仕様書(2) 全13フィールド) ---
  const payload = buildSubmitPayload({
    bundle,
    client,
    email,
    maisokuFileId,
    photoFileIds,
    aspectRatio: aspectRatio as AspectRatio,
    dealType: dealType as DealType,
  });

  const violations = payloadViolations(payload);
  if (violations.length > 0) {
    // ここに来るのは実装バグ(顧客入力ミスは上で全て弾いている)
    console.error("[portal/submit] payload invariant violation:", violations);
    return NextResponse.json(
      { ok: false, error: "内部エラーが発生しました。担当者までご連絡ください" },
      { status: 500 }
    );
  }

  // --- 送信ゲート ---
  if (!isSubmitEnabled()) {
    // ドライラン: webhook へは一切 fetch しない。Drive アップロード+
    // ペイロード組み立てまでは実施済み(権限検証・掃除cron回収の実地
    // 確認になり、7日で自動回収されるため可逆)。
    console.log(
      "[portal/submit] DRY RUN (PORTAL_SUBMIT_ENABLED!=true) payload:",
      JSON.stringify(maskPayload(payload))
    );
    return NextResponse.json({
      ok: true,
      sent: false,
      dry_run: true,
      message:
        "送信機能は準備中です。アップロードとリクエスト内容の検証まで完了しました(この依頼はまだ制作に回っていません)",
      exec_id: bundle.exec_id,
      photo_count: photoCount,
      payload: maskPayload(payload),
    });
  }

  try {
    const result = await dispatchSubmit(payload);
    if (!result.sent) {
      if (result.reason === "already_dispatched") {
        // FIX2-A: 同一execバンドルでの再送(多重クリック・ネットワーク
        // 再送・トークンのリプレイ)。二重生成・クォータ二重消費を防ぐ
        // ため送らない。
        return NextResponse.json(
          { ok: false, error: "この依頼は既に送信済みです" },
          { status: 409 }
        );
      }
      if (result.reason === "marker_failed") {
        // FIX2-A fail-closed: 冪等性マーカーが書けなかった=送信を保証
        // できない状態。旧実装はここをbest-effortで握り潰してdispatch
        // していたが、それをやめて明示的にエラー扱いにする。
        return NextResponse.json(
          {
            ok: false,
            error: "送信処理に失敗しました。時間をおいて再度お試しください",
          },
          { status: 500 }
        );
      }
      // isSubmitEnabled() と dispatchSubmit 内の二重ゲートの整合上ここには
      // 来ないはずだが(reason === "disabled")、防御的に dry-run と同じ
      // 扱いにする
      return NextResponse.json({
        ok: true,
        sent: false,
        dry_run: true,
        message: "送信機能は準備中です",
        exec_id: bundle.exec_id,
      });
    }
    console.log(
      `[portal/submit] dispatched exec_id=${bundle.exec_id} client=${client.client_id} status=${result.status}`
    );
    if (result.status >= 300) {
      // HTTPレベルの失敗のみエラー扱い(200=受理ではない・罠(4)-3)
      // TODO(実弾後ハードニング): 顧客向けエラーに生HTTPステータスを
      // 出している(SubmitForm.tsx:89の同種の生ステータス露出とセットで
      // 直す) — 内部実装詳細の露出を避け、汎用メッセージ+サーバーログ
      // (上のconsole.log/エラーログ)側でステータスを追えるようにする。
      return NextResponse.json(
        {
          ok: false,
          error: `送信に失敗しました(HTTP ${result.status})。時間をおいて再度お試しください`,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      sent: true,
      exec_id: bundle.exec_id,
    });
  } catch (e) {
    console.error("[portal/submit] dispatch failed:", e);
    return NextResponse.json(
      { ok: false, error: "送信に失敗しました。時間をおいて再度お試しください" },
      { status: 502 }
    );
  }
}
