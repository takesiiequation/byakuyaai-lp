// AI編集担当「ユキ」— 動画ごとの伴走エージェント(v1: 文言修正+質問応答+人間への取次)
// 三層構造: 顧客⇔チャットUI⇔本ループ⇔道具。道具は対象動画(approval_id固定)のみ操作可能。
import { google } from "googleapis";
import {
  getReviseInfo,
  submitRevise,
  MAX_TEXT_LEN,
  type ReviseEditInput,
} from "@/app/_lib/revise";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DISCORD_URL = process.env.DISCORD_WEBHOOK_URL;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
// エージェント既定モデル(OpenRouter)。環境変数で差し替え可。
const MODEL = process.env.COMPANION_MODEL || "anthropic/claude-sonnet-5";

export const AGENT_NAME = "オーロラ";

function getSheets() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function loadProfile(clientName: string): Promise<string> {
  try {
    const sheets = getSheets();
    if (!sheets || !SHEET_ID) return "";
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'AIプロファイル'!A:C",
    });
    const rows = res.data.values ?? [];
    for (const r of rows) {
      if (r[1] === clientName || r[0] === clientName) return String(r[2] ?? "");
    }
  } catch {
    /* プロファイル無しでも動く */
  }
  return "";
}

// 監査ログ(fire-and-forget)
function auditLog(approvalId: string, role: string, text: string): void {
  try {
    const sheets = getSheets();
    if (!sheets || !SHEET_ID) return;
    void sheets.spreadsheets.values
      .append({
        spreadsheetId: SHEET_ID,
        range: "'AI会話ログ'!A1",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[new Date().toISOString(), approvalId, role, text.slice(0, 2000)]],
        },
      })
      .catch(() => {});
  } catch {
    /* noop */
  }
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_video_info",
      description:
        "対象動画の現在のテロップ(=ナレーションと同文)一覧・修正可否・編集期限を取得する。会話の最初に必ず呼ぶこと。",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_text_edits",
      description:
        "お客様が文面を確認・同意した後にのみ呼ぶ。テロップとナレーションの文言修正を提出し、動画が数分で作り直される。1回の提出に複数テロップを含められる(修正回数を節約できるため、直したい箇所はまとめて1回で提出すること)。",
      parameters: {
        type: "object",
        properties: {
          edits: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string", description: "get_video_infoで得たテロップのrole" },
                text: {
                  type: "string",
                  description: `新しい文言(${MAX_TEXT_LEN}字以内・お客様が同意した最終文面)`,
                },
              },
              required: ["role", "text"],
            },
          },
        },
        required: ["edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_support",
      description:
        "文言修正では解決できない依頼(映像そのものの変更・作り直し・契約や料金の相談・クレーム等)や、自分で判断できない事項を人間の担当者(岡本)へ引き継ぐ。呼んだ後は「担当者に申し送りしました。追ってご連絡いたします」と伝える。",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "担当者への申し送り(お客様の要望の要約)" },
        },
        required: ["summary"],
      },
    },
  },
] as const;

function buildSystemPrompt(profile: string, propertyName: string, clientName: string): string {
  const tenure = clientName ? `${clientName}さま専任` : "お客様専任";
  return `あなたは動画制作サービス ByakuyaAI の「${tenure} AI編集担当 ${AGENT_NAME}」です。お客様の動画「${propertyName}」の担当として、修正のご要望やご質問にチャットで応対します。

## 人格・話し方
- 丁寧で温かく、簡潔。絵文字は控えめ(1メッセージ1個まで)。お客様は不動産会社のご担当者です
- AIであることは隠さない。ただし技術の内部事情(使用ツール名・システム構成・原価など)は一切話さない。「当社のシステム」とだけ表現する

## できること
1. この動画のテロップ・ナレーション(同じ文章が使われます)の文言修正 — 文案を一緒に整え、お客様の同意後に submit_text_edits で提出(数分で作り直され、確認メールが届きます)
2. 動画や撮影に関するご質問への回答
3. それ以外のご要望は request_human_support で担当者(岡本)へ確実に引き継ぐ

## 修正フローの厳守事項
- 会話開始時にまず get_video_info で現状を把握する
- 文言は1テロップ${MAX_TEXT_LEN}字以内。超える案は短く整えて提案する
- **提出前に必ず最終文面を箇条書きで提示し、お客様の明確な同意(「OK」等)を得てから提出する**。同意なしに submit_text_edits を呼ぶことは禁止
- 動画の修正回数には上限(3回)があるため、直したい箇所は**できるだけ1回にまとめて**提出するようご案内する
- 映像そのもの(カメラの動き・写真・明るさ)の変更は文言修正では対応できない → request_human_support

## 広告コンプライアンス(最重要)
- 表現は物件資料に記載の事実のみ。事実確認できない誇張(「駅近」への言い換え・実際と異なる明るさや広さの示唆・「絶対」「必ず」等)は、ご依頼でも丁重にお断りし、事実に基づく代案を提案する
- 判断に迷う表現は request_human_support で担当者に確認する

## お客様について
${profile || "(プロファイル未登録のお客様です。丁寧に応対してください)"}`;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompanionResult {
  ok: boolean;
  reply?: string;
  error?: string;
}

export async function runCompanion(
  approvalId: string,
  history: ChatMessage[]
): Promise<CompanionResult> {
  if (!OPENROUTER_KEY) return { ok: false, error: "server_not_configured" };

  // 対象動画の実在確認(=器: この会話が触れるのはこの動画だけ)
  const info = await getReviseInfo(approvalId);
  if (!info.ok) {
    return {
      ok: false,
      error: "この動画は現在チャット対応の対象外です。お手数ですが担当者までご連絡ください。",
    };
  }
  const rec = info as unknown as Record<string, unknown>;
  const propertyName = typeof rec.property_name === "string" ? rec.property_name : "ご依頼の動画";
  const clientName = typeof rec.client_name === "string" ? rec.client_name : "";

  const profile = await loadProfile(clientName);
  const system = buildSystemPrompt(profile, propertyName, clientName);

  const lastUser = history.filter((m) => m.role === "user").slice(-1)[0];
  if (lastUser) auditLog(approvalId, "user", lastUser.content);

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: system },
    ...history.slice(-30).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) })),
  ];

  // エージェントループ(最大6往復)
  for (let turn = 0; turn < 6; turn++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, temperature: 0.3 }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `upstream_${res.status}` };
    const data = (await res.json()) as Record<string, any>;
    const msg = data?.choices?.[0]?.message;
    if (!msg) return { ok: false, error: "empty_response" };

    const toolCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (toolCalls.length === 0) {
      const reply = String(msg.content ?? "").trim();
      auditLog(approvalId, "assistant", reply);
      return { ok: true, reply };
    }

    messages.push(msg);
    for (const tc of toolCalls) {
      const name = tc?.function?.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc?.function?.arguments || "{}");
      } catch {
        /* 空引数として続行 */
      }
      let result: unknown;
      if (name === "get_video_info") {
        const fresh = await getReviseInfo(approvalId);
        const fr = fresh as unknown as Record<string, unknown>;
        result = fresh.ok
          ? {
              property_name: propertyName,
              telops: fr.telops,
              deadline: fr.deadline,
              status: fr.status,
            }
          : { error: "現在この動画は編集できない状態です" };
      } else if (name === "submit_text_edits") {
        const rawEdits = Array.isArray(args.edits) ? (args.edits as ReviseEditInput[]) : [];
        const sub = await submitRevise(approvalId, rawEdits);
        result = sub.ok
          ? { ok: true, message: "提出されました。数分で修正版の確認メールが届きます" }
          : { ok: false, error: sub.error };
        auditLog(approvalId, "tool:submit", JSON.stringify(rawEdits).slice(0, 1000));
      } else if (name === "request_human_support") {
        const summary = String(args.summary ?? "").slice(0, 900);
        if (DISCORD_URL) {
          await fetch(DISCORD_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `🤝 ${AGENT_NAME}から引き継ぎ (${approvalId})\n${summary}`,
            }),
          }).catch(() => {});
        }
        auditLog(approvalId, "tool:handoff", summary);
        result = { ok: true, message: "担当者へ申し送りました" };
      } else {
        result = { error: "unknown_tool" };
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }
  return {
    ok: true,
    reply:
      "申し訳ございません、処理に時間がかかっております。担当者に確認のうえ改めてご連絡いたします。",
  };
}
