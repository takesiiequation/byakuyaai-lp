import { NextRequest } from "next/server";
import { isMeAuthed } from "@/app/_lib/meAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 2026-08-25 実測: gemini-2.5-flash / gemini-2.0-flash は一覧に載っていても
// generateContent が 404。lite 系は速いが JSON を配列で包んで返すことがあり
// 精度も粗い。3.5-flash が 2.9〜4.2 秒で最も安定していたため既定にする。
// ただし版番号付きはいつか消えるので、404 のときだけ *-latest（現行モデルを
// 指すエイリアス）へ自動で切り替える。今回と同じ壊れ方を繰り返さないため。
const MODEL = process.env.ME_AI_MODEL || "gemini-3.5-flash";
const FALLBACK = "gemini-flash-latest";
const ENDPOINT = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

const PROMPT = `あなたは管理栄養士です。日本の一般的な外食・家庭料理として、示された食事のタンパク質量を推定してください。
必ず次のJSONだけを返し、前後に説明やコードフェンスを付けないこと。
{"items":[{"name":"料理名","grams":整数,"note":"根拠を20字以内"}],"total":整数}
- grams は**示された分量ぶんの合計**（「2人前」なら2人前ぶん）のタンパク質グラム数
- 複数の料理が写っている/書かれている場合は items に分けて列挙
- 判別できない場合は items を空配列、total を 0 にする`;

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function POST(req: NextRequest) {
  if (!(await isMeAuthed())) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Not an error the user can fix from the phone — the UI falls back to its
    // built-in estimate table when this comes back.
    return Response.json(
      { ok: false, error: "AI推定は未設定です（GEMINI_API_KEY）" },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: unknown;
    image?: unknown; // data URL or bare base64
    mime?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
  const rawImage = typeof body.image === "string" ? body.image : "";
  const image = rawImage.includes(",") ? rawImage.slice(rawImage.indexOf(",") + 1) : rawImage;
  const mime =
    typeof body.mime === "string" && /^image\/(png|jpeg|jpg|webp)$/.test(body.mime)
      ? body.mime
      : "image/jpeg";

  if (!text && !image) {
    return Response.json({ ok: false, error: "テキストか画像が必要です" }, { status: 400 });
  }
  // ~8 MiB of base64 ≈ 6 MiB of image; well under Gemini's inline limit and
  // small enough that a slow mobile upload still finishes inside maxDuration.
  if (image.length > 8_000_000) {
    return Response.json({ ok: false, error: "画像が大きすぎます" }, { status: 413 });
  }

  const parts: Part[] = [{ text: PROMPT }];
  if (text) parts.push({ text: `食べたもの: ${text}` });
  if (image) parts.push({ inline_data: { mime_type: mime, data: image } });

  const ask = (model: string) =>
    fetch(`${ENDPOINT(model)}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });

  let res: Response;
  let used = MODEL;
  try {
    res = await ask(MODEL);
    if (res.status === 404 && MODEL !== FALLBACK) {
      used = FALLBACK;
      res = await ask(FALLBACK);
    }
  } catch (e) {
    return Response.json({ ok: false, error: `AIに接続できません: ${e}` }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const hint =
      res.status === 404
        ? `モデルが使えません（${MODEL} も ${FALLBACK} も 404）`
        : `AIエラー (${res.status})`;
    return Response.json(
      { ok: false, error: hint, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  type Parsed = { items?: { name?: string; grams?: number; note?: string }[]; total?: number };
  let parsed: Parsed;
  try {
    const raw2 = JSON.parse(cleaned);
    // lite 系は稀に [{items:[...]}] と配列で包んで返す。1段だけ剥がす。
    parsed = (Array.isArray(raw2) ? raw2[0] : raw2) as Parsed;
  } catch {
    return Response.json(
      { ok: false, error: "AIの返答を読めませんでした", detail: cleaned.slice(0, 200) },
      { status: 502 }
    );
  }

  const items = (parsed.items || [])
    .map((i) => ({
      name: String(i.name || "").slice(0, 40),
      grams: Math.max(0, Math.min(300, Math.round(Number(i.grams) || 0))),
      note: String(i.note || "").slice(0, 40),
    }))
    .filter((i) => i.name);
  const total = items.reduce((a, b) => a + b.grams, 0);
  return Response.json({ ok: true, items, total, model: used });
}
