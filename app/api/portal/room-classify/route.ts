import { NextRequest, NextResponse } from "next/server";
import { requirePortalClient } from "@/app/_lib/portalSubmitGuard";

// P3(部屋名Vision自動下書き・2026-07-22・fudosan-video/docs/smapho_hitotsu_
// design.md「UIテスト実測レポート」P3改修): 実写真はIMG_xxxx.jpgのため
// ファイル名ヒントが効かず、自動仕分け後の部屋名が全部「お部屋」になる
// (roomAutoPairing.tsのTENTATIVE_ROOM_LABEL)。アップロード直後に軽量
// Vision(Gemini flash-lite系)で1枚だけ分類し、部屋名チップの下書きを返す。
//
// このルートは「分類結果を返すだけ」で、部屋への適用可否(顧客が既に
// 触ったカードには適用しない、という生命線の条件)はクライアント側
// (SubmitForm.tsx)の責任 — ここはVisionの生の推定を返すだけの薄いAPI。
//
// fail-soft方針(全面): GEMINI_API_KEY未設定/呼び出し失敗/タイムアウトは
// すべて204(コンテンツ無し)。下書きが付かないだけで送信フローは一切
// ブロックしない。語彙外・JSONパース失敗は{label:"その他"}を200で返す
// (呼び出し側が「その他」を非採用として扱う=design.md仕様どおり)。

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 8_000;

// クライアントは長辺256px・quality0.7のJPEGを送る想定(200KB程度)。
// JSON全体(base64+わずかなラッパー)が約300KBを超えたら不正リクエストと
// して即400で弾く(想定外の巨大画像・悪意ある直叩き対策)。
const MAX_BODY_BYTES = 300 * 1024;

const ROOM_LABELS = [
  "リビング",
  "キッチン",
  "浴室",
  "洗面",
  "トイレ",
  "玄関",
  "廊下",
  "洋室",
  "和室",
  "バルコニー",
  "外観",
  "その他",
] as const;
const ROOM_LABEL_SET = new Set<string>(ROOM_LABELS);

const PROMPT =
  "この室内写真の部屋種別を次の語彙から1つだけ選んでJSONで返せ: リビング/キッチン/浴室/洗面/トイレ/玄関/廊下/洋室/和室/バルコニー/外観/その他。迷ったら「その他」。{\"label\":\"...\"}のみ出力";

/** Geminiの応答テキストからlabelを取り出す。```json フェンス付き・
 * 前後に余計な文字が付く等の揺れをfail-softに吸収する。語彙外/パース
 * 失敗は仕様どおり"その他"にフォールバックする(呼び出し側が非採用扱い
 * にする値のため、ここで例外を投げる必要はない)。 */
function extractLabel(text: string): string {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) return "その他";
  try {
    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as { label?: unknown };
    if (typeof parsed.label === "string" && ROOM_LABEL_SET.has(parsed.label)) {
      return parsed.label;
    }
  } catch {
    // fall through
  }
  return "その他";
}

export async function POST(req: NextRequest) {
  const guard = await requirePortalClient();
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // fail-soft: 鍵未設定は機能OFF相当。204でクライアントは無風に扱う。
    return new NextResponse(null, { status: 204 });
  }

  // content-lengthヘッダでの事前チェック(あれば安く弾ける)。無い/不正な
  // 場合でも下のrawText実測チェックが最終防波堤になる。
  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  if (Buffer.byteLength(rawText, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  let body: { image?: unknown };
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const rawImage = typeof body.image === "string" ? body.image : "";
  // クライアントは生base64(data:プレフィックス無し)で送る想定だが、
  // 万一data URLのまま来ても剥がして受ける(fail-soft)。
  const commaIdx = rawImage.indexOf(",");
  const base64 =
    rawImage.startsWith("data:") && commaIdx !== -1 ? rawImage.slice(commaIdx + 1) : rawImage;
  if (!base64) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: "image/jpeg", data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 50 },
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!geminiRes.ok) {
      console.error(`[portal/room-classify] gemini HTTP ${geminiRes.status} (fail-soft)`);
      return new NextResponse(null, { status: 204 });
    }

    const data = (await geminiRes.json().catch(() => null)) as
      | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      | null;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      // 安全フィルタでブロックされた等、テキストが無い応答も下書き無しと
      // して扱う(fail-soft)。
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ label: extractLabel(text) });
  } catch (e) {
    console.error("[portal/room-classify] failed (fail-soft):", e);
    return new NextResponse(null, { status: 204 });
  }
}
