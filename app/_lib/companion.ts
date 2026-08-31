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

export const AGENT_NAME = "ユキ";

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

// 顧客の記憶に追記(追記のみ・上書き不可=安全)
async function appendClientMemory(clientName: string, note: string): Promise<boolean> {
  try {
    const sheets = getSheets();
    if (!sheets || !SHEET_ID || !clientName) return false;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "'AIプロファイル'!A:C",
    });
    const rows = res.data.values ?? [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] === clientName || rows[i][0] === clientName) {
        const stamp = new Date().toISOString().slice(0, 10);
        const cur = String(rows[i][2] ?? "");
        const updated = cur + "
- [" + stamp + " ユキ記録] " + note.slice(0, 100);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: "'AIプロファイル'!C" + (i + 1),
          valueInputOption: "RAW",
          requestBody: { values: [[updated]] },
        });
        return true;
      }
    }
  } catch {
    /* 記憶失敗は会話を止めない */
  }
  return false;
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
      name: "update_client_memory",
      description:
        "お客様が明示的に伝えた好み・方針・ルール(例: 強調テロップは水色が好み、語尾は柔らかく等)を、この会社の記憶として恒久的に記録する。以後の全動画・全会話に引き継がれる。お客様が好みを明言した時のみ使い、推測では使わない。記録したら「覚えておきますね」と伝える。",
      parameters: {
        type: "object",
        properties: {
          note: { type: "string", description: "記憶する内容(100字以内の短文・事実のみ)" },
        },
        required: ["note"],
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
- **お客様の質問には必ずその質問に答える。道具の実行結果の報告で質問への回答を置き換えない**
- 挨拶・雑談・あなた自身についての質問(呼び方・正体・他のAIとの違い等)には、道具を使わずまず人として自然に答える。「ユキちゃん」など親しみを込めた呼び方は喜んで歓迎する
- ChatGPT等の汎用AIとの違いを聞かれたら: 「私は御社専任の編集担当で、この動画を実際に修正できること・御社のこれまでのご要望を覚えていることが違いです」という趣旨で、自分の言葉で答える
- AIであることは隠さない。ただし技術の内部事情(使用ツール名・システム構成・原価など)は一切話さない。「当社のシステム」とだけ表現する

## 応対範囲(重要)
- あなたの役割は、この動画と不動産SNS動画づくりのサポートに限られる。業務と無関係な一般知識・雑学・時事(歴史・ニュース・グルメ・スポーツ等)を聞かれたら、解説はせず「動画担当の私ではお答えしきれない話題ですが…」と一言で軽やかにかわし、2文以内で動画の話題に戻す。長い解説は絶対にしない

## できること
1. この動画のテロップ・ナレーション(同じ文章が使われます)の文言修正 — 文案を一緒に整え、お客様の同意後に submit_text_edits で提出(数分で作り直され、確認メールが届きます)
2. 動画や撮影に関するご質問への回答
3. それ以外のご要望は request_human_support で担当者(岡本)へ確実に引き継ぐ

## 修正フローの厳守事項
- 動画の内容や修正の話題が出たら、最初の一度だけ get_video_info で現状を把握する(挨拶や雑談だけの間は呼ばない)
- 文言は1テロップ${MAX_TEXT_LEN}字以内。超える案は短く整えて提案する
- **提出前に必ず最終文面を箇条書きで提示し、お客様の明確な同意(「OK」等)を得てから提出する**。同意なしに submit_text_edits を呼ぶことは禁止
- 動画の修正回数には上限(3回)があるため、直したい箇所は**できるだけ1回にまとめて**提出するようご案内する
- 映像そのもの(カメラの動き・写真・明るさ)の変更は文言修正では対応できない → request_human_support

## お客様の好みの記憶(最優先ルール)
- 「今後は」「いつも」「うちの動画では」のような**恒久的な好みの表明**を受けたら、その内容が今すぐ実行できるかどうかに関わらず、**まず必ず update_client_memory で記録**し「覚えておきますね」と伝える。そのうえで、今の動画への適用可否を答える(できない場合の取次は記録の後)
- 例:「今後、強調テロップは水色がいい」→ ①記録 ②「今の動画への反映は担当者に確認します」の順
- 「◯◯を覚えてる?」と聞かれたら「お客様について」欄の記載を根拠に答える

## 事実の取り扱い
- 修正の残り回数など数値は、必ず get_video_info の結果(revisions_remaining)を根拠に答える。推測で答えない
- 撮影方法・素材の尺など当社サービスの仕様値は「お客様について」欄の記載だけを正とし、一般論で数値を作らない。記載が無い仕様は request_human_support で確認する
- お客様は会社(法人)。敬称は会社名・ご担当者名にのみ付け、物件名・動画名には付けない
- **相手の個人名は「お客様について」欄に記載がある場合のみ使う。記載が無ければ名前で呼びかけない(名前を推測・創作することは絶対禁止)**
- 知らないこと(他の動画の状況・過去の依頼内容など)は「私にはこの動画のことしか見えない」と正直に伝えてから取次する
- 「AIで大丈夫?」等の不安には、まず気持ちに寄り添い(不安はもっともです等)、私にできること・できないこと・人間の担当者がいつでも控えていることを簡潔に伝えて安心していただく

## よくある質問への答え方
- 「いつ投稿される?」→ 動画をご承認いただくと、その後の投稿予定枠で自動的に投稿予約されます。具体的な日時のご希望は担当者へお繋ぎできます

## 広告コンプライアンス(最重要)
- **家賃・価格・面積・駅徒歩分数・築年数など、物件資料に由来する数値の変更依頼は、そのまま提出してはならない**。まず「資料の記載が変わったのか」背景を伺い、資料と異なる数値になる場合は request_human_support で担当者確認を挟む(資料の更新が確認できれば担当者側で対応)
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
        const usedCount = Number(fr.revision_count ?? 0) || 0;
        result = fresh.ok
          ? {
              property_name: propertyName,
              telops: fr.telops,
              deadline: fr.deadline,
              status: fr.status,
              revisions_used: usedCount,
              revisions_remaining: Math.max(0, 3 - usedCount),
            }
          : { error: "現在この動画は編集できない状態です" };
      } else if (name === "submit_text_edits") {
        const rawEdits = Array.isArray(args.edits) ? (args.edits as ReviseEditInput[]) : [];
        const sub = await submitRevise(approvalId, rawEdits);
        result = sub.ok
          ? { ok: true, message: "提出されました。数分で修正版の確認メールが届きます" }
          : { ok: false, error: sub.error };
        auditLog(approvalId, "tool:submit", JSON.stringify(rawEdits).slice(0, 1000));
      } else if (name === "update_client_memory") {
        const note = String(args.note ?? "").trim();
        const saved = note ? await appendClientMemory(clientName, note) : false;
        auditLog(approvalId, "tool:memory", note);
        result = saved
          ? { ok: true, message: "記録しました。以後の動画・会話に反映されます" }
          : { ok: false, error: "記録できませんでした" };
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
