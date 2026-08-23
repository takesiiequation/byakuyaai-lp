import { google } from "googleapis";

// Client-portal dashboard data layer (/portal). Reads the "制作状況" tab of
// the SAME central spreadsheet as 承認待ち (GOOGLE_SHEET_ID) — see
// docs/property_db_f_design.md §P1.2. That tab is written by
// fudosan_v15-prod's `PortalStatus: Insert Received` node (n8n side, out of
// scope for this app) — this module only ever reads it.
//
// Absolute rule (design §P1.2 "重要な安全設計"): this module must NEVER read
// the 承認待ち tab directly — its `post_data` column carries a plaintext
// Publer API key. Detail lookups for a specific approval go through the
// existing sanitized getReviseInfo() relay (app/_lib/revise.ts) instead,
// which is deliberately not called from here (P1 dashboard shows only the
// coarse status list; "確認・修正する" links out to the existing
// /revise/[approvalId] page, which does its own getReviseInfo call).
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const PRODUCTION_TAB = process.env.GOOGLE_SHEET_PRODUCTION_TAB || "制作状況";
const qt = (tab: string) => `'${tab.replace(/'/g, "''")}'`; // 日本語タブ名はA1記法でクォート必須

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const key = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export interface ProductionRow {
  exec_id: string;
  client_id: string;
  client_name: string;
  property_name: string;
  status: string;
  approval_id: string;
  created_at: string;
  updated_at: string;
  /** I列(2026-07-27追加)。'true' なら顧客のマイページ一覧から除外する
   * (岡本発案:「失敗しましたの欄が何個もあって邪魔、消せるようにできない?」
   * — データは消さず非表示フラグだけ立てる)。書き込みは
   * app/api/portal/status/hide/route.ts → hideProductionRow のみ。 */
  hidden: string;
}

function rowToProduction(headers: string[], row: string[]): ProductionRow {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] ?? "";
  });
  return {
    exec_id: obj.exec_id ?? "",
    client_id: obj.client_id ?? "",
    client_name: obj.client_name ?? "",
    property_name: obj.property_name ?? "",
    status: obj.status ?? "",
    approval_id: obj.approval_id ?? "",
    created_at: obj.created_at ?? "",
    updated_at: obj.updated_at ?? "",
    hidden: obj.hidden ?? "",
  };
}

/**
 * Reads `制作状況`, filtered to one client_id, newest-first. Fail-soft
 * (mirrors lineKnowledge.ts / getApprovalQueue): a not-yet-created tab, a
 * missing client_id column, or any Sheets API error all just yield [] so the
 * dashboard renders an empty-state instead of a 500 — this tab's rollout
 * (n8n side) can lag behind this app's deploy without breaking the page.
 */
export async function getProductionRows(
  clientId: string
): Promise<ProductionRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(PRODUCTION_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0] as string[];
    const idCol = headers.indexOf("client_id");
    if (idCol === -1) return [];

    return rows
      .slice(1)
      .filter((r) => (r as string[])[idCol] === clientId)
      .map((r) => rowToProduction(headers, r as string[]))
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  } catch {
    return [];
  }
}

export type PortalStatus =
  | "processing"
  | "pending_approval"
  | "revising"
  | "posted"
  | "delivered"
  | "sold"
  | "rejected"
  | "failed"
  | "revise_failed"
  | "quota_exceeded"
  | "unknown";

/**
 * Read-time status derivation (design §P1.2, TS移植 of the reference impl).
 * Unknown/empty/garbage status values all round down to "processing" rather
 * than being treated as done — never claim completion the pipeline hasn't
 * actually reported.
 *
 * "revising"(修正依頼中)は 2026-07-15 追加 — 差し戻しWF側がこの値を書く
 * 改修は別途進行中で、この時点ではシートにまだ現れない。フロントは先に
 * この値を認識できるようにしておくだけ(fail-soft: 来なければ従来通り
 * "processing" に丸め込まれるだけで壊れない)。
 *
 * "failed"/"revise_failed"(障害ステータス)も同様に先行追加 — 本体WF/差し
 * 戻しWF側でこれらの値を書く改修は別便(status_visibility_package_draft.md)。
 * n8n側が未着手の間はシートにこの値がまだ現れないだけで、フロントは
 * fail-soft に壊れず従来通り "processing" に丸め込まれる。
 *
 * "quota_exceeded"(今月の本数を使い切った)は 2026-08-23 追加 — 岡本判断で
 * 「今月の生成上限に達しました」の顧客メールを廃止し、マイページ表示に一本化
 * したもの(以前これがメールで届いて小濱さんを驚かせた)。認証系の他の拒否理由
 * (quota_not_configured / 秘密鍵エラー)は顧客側で対処できないため、あえて
 * マイページには出さずDiscord通知のみに留める。"failed" に寄せてしまうと
 * 「もう一度ご依頼ください」と再依頼を促す導線が出てしまい誤案内になる。
 */
export function resolveStatus(row: ProductionRow | null): PortalStatus {
  if (!row) return "unknown";
  const s = String(row.status || "").trim();
  if (
    s === "posted" ||
    s === "delivered" ||
    s === "sold" ||
    s === "pending_approval" ||
    s === "rejected" ||
    s === "revising" ||
    s === "failed" ||
    s === "revise_failed" ||
    s === "quota_exceeded"
  ) {
    return s;
  }
  return "processing";
}

export const PORTAL_STATUS_LABELS: Record<PortalStatus, string> = {
  processing: "制作中",
  pending_approval: "承認待ち",
  revising: "✏️ 編集を反映中",
  posted: "投稿済み",
  delivered: "✉️ 納品済み",
  sold: "🎉 成約済み",
  rejected: "却下",
  failed: "⚠️ 生成に失敗しました",
  revise_failed: "⚠️ 編集の反映に失敗しました",
  quota_exceeded: "今月の本数を使い切りました",
  unknown: "不明",
};

export const PORTAL_STATUS_COLORS: Record<PortalStatus, string> = {
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  pending_approval: "bg-amber-50 text-amber-700 border-amber-200",
  revising: "bg-purple-50 text-purple-700 border-purple-200",
  posted: "bg-green-50 text-green-700 border-green-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  sold: "bg-orange-50 text-orange-700 border-orange-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  failed: "bg-red-50 text-red-700 border-red-300",
  revise_failed: "bg-red-50 text-red-700 border-red-300",
  // 上限到達は「異常」ではなく正常な残数ゼロなので、障害系の赤ではなく
  // 落ち着いた色にする(顧客を不安にさせないための意図的な色分け)。
  quota_exceeded: "bg-slate-100 text-slate-600 border-slate-300",
  unknown: "bg-gray-100 text-gray-400 border-gray-200",
};

/**
 * Terminal (done, nothing left for the client to act on) vs. active
 * statuses. Used by the portal dashboard to keep every row that might need
 * a client action always on-screen while collapsing old finished rows —
 * see PortalPage's visible/hidden split. "unknown" deliberately counts as
 * active (not terminal): never hide a row we can't positively confirm is
 * done. "failed"/"revise_failed" are deliberately non-terminal too — they
 * are an action-needed state (再依頼/再送信待ち), not a done state; treating
 * them as terminal would let them get buried behind the 5-row collapse and
 * the client could miss a failure that needs a retry.
 */
export function isTerminalStatus(status: PortalStatus): boolean {
  return (
    status === "posted" ||
    status === "delivered" ||
    status === "sold" ||
    status === "rejected"
  );
}

/**
 * 岡本発案(2026-07-27):「失敗しましたの欄が何個もあって邪魔、消せるように
 * できない?」への対応。データそのものは消さず I列(hidden)に 'true' を
 * 立てるだけ — シート上には行が残る(監査可能)ので、n8n側や管理者が見る
 * ビューには一切影響しない。ポータル一覧側の除外は app/portal/page.tsx で
 * hidden==='true' をフィルタする。
 *
 * 呼び出し元(app/api/portal/status/hide/route.ts)は既に
 * requirePortalClient でセッション検証済みだが、この関数自身も
 * 「exec_id完全一致 かつ client_idがセッションのclientIdと一致 かつ
 * ステータスが失敗系(failed/revise_failed)」を再検証してから書き込む —
 * 他社の行や失敗系以外の行を誤って隠す経路を作らない多重防御。
 *
 * 行の特定は「制作状況!A:I を丸ごと読んで exec_id 完全一致行のindex+1」。
 * 書き込みは values.update で 制作状況!{hidden列}{row} の1セルのみ —
 * 他の列・他の行には絶対に書かない。
 */
export async function hideProductionRow(
  clientId: string,
  execId: string
): Promise<"ok" | "not_found" | "error"> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(PRODUCTION_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return "not_found";
    const headers = rows[0] as string[];
    const execCol = headers.indexOf("exec_id");
    const clientCol = headers.indexOf("client_id");
    const hiddenCol = headers.indexOf("hidden");
    if (execCol === -1 || clientCol === -1 || hiddenCol === -1) {
      return "not_found";
    }

    const rowIdx = rows.findIndex(
      (r, i) => i > 0 && (r as string[])[execCol] === execId
    );
    if (rowIdx === -1) return "not_found";

    const row = rows[rowIdx] as string[];
    // 他社の行は「見つからなかった」扱いにする(存在自体を漏らさない —
    // 404かどうかで他クライアントのexec_idの存在を推測されないようにする)。
    if (row[clientCol] !== clientId) return "not_found";

    const status = resolveStatus(rowToProduction(headers, row));
    if (status !== "failed" && status !== "revise_failed") {
      return "not_found"; // 失敗系以外は非表示化の対象外
    }

    // hiddenCol は headers.indexOf 由来(列が将来増えても追従)。現状I列
    // (index 8)想定だがシートは列数が少ないので1文字で足りる。
    const colLetter = String.fromCharCode("A".charCodeAt(0) + hiddenCol);
    const rowNum = rowIdx + 1;
    // ⚠️ RAW必須: USER_ENTERED だと Sheets が 'true' を boolean TRUE に
    // 強制変換し、values.get の読み戻しが 'TRUE' になって表示層の
    // hidden==='true' 判定をすり抜ける(=消したのに消えない)。
    await sheets().spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${qt(PRODUCTION_TAB)}!${colLetter}${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [["true"]] },
    });
    return "ok";
  } catch {
    return "error";
  }
}

/**
 * 成約報告(2026-08-01 岡本発案:「物件成約したときシステムに伝えるロジック
 * なくね?」/ 2026-08-02 仕様確定)。ポータルの投稿済み/納品済み行の
 * 「成約しました」ボタンから呼ばれ、statusを'sold'へ更新する。
 * 用途はLINEお問い合わせAIの応答制御 — 成約済み物件への内見予約等を
 * 「そちらの物件は成約済みです」と案内して弾くためのデータ。
 * SNS投稿の削除・管理者通知はしない(岡本の手を煩わせないのが要件)。
 *
 * 防御は hideProductionRow と同型: exec_id一致+client_id一致+対象ステータス
 * (posted/delivered)のみ。他社の行は404扱いで存在を漏らさない。
 */
export async function markRowSold(
  clientId: string,
  execId: string
): Promise<
  | { result: "ok"; propertyName: string; clientName: string }
  | { result: "not_found" }
  | { result: "error" }
> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: qt(PRODUCTION_TAB),
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return { result: "not_found" };
    const headers = rows[0] as string[];
    const execCol = headers.indexOf("exec_id");
    const clientCol = headers.indexOf("client_id");
    const statusCol = headers.indexOf("status");
    const updatedCol = headers.indexOf("updated_at");
    const propCol = headers.indexOf("property_name");
    const nameCol = headers.indexOf("client_name");
    if (execCol === -1 || clientCol === -1 || statusCol === -1) {
      return { result: "not_found" };
    }

    const rowIdx = rows.findIndex(
      (r, i) => i > 0 && (r as string[])[execCol] === execId
    );
    if (rowIdx === -1) return { result: "not_found" };

    const row = rows[rowIdx] as string[];
    if (row[clientCol] !== clientId) return { result: "not_found" };

    const status = resolveStatus(rowToProduction(headers, row));
    if (status !== "posted" && status !== "delivered") {
      return { result: "not_found" }; // 投稿/納品済み以外は成約報告の対象外
    }

    const rowNum = rowIdx + 1;
    const col = (i: number) => String.fromCharCode("A".charCodeAt(0) + i);
    await sheets().spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${qt(PRODUCTION_TAB)}!${col(statusCol)}${rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [["sold"]] },
    });
    if (updatedCol !== -1) {
      await sheets().spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${qt(PRODUCTION_TAB)}!${col(updatedCol)}${rowNum}`,
        valueInputOption: "RAW",
        requestBody: { values: [[new Date().toISOString()]] },
      });
    }
    return {
      result: "ok",
      propertyName: (propCol !== -1 && row[propCol]) || "(物件名なし)",
      clientName: (nameCol !== -1 && row[nameCol]) || clientId,
    };
  } catch {
    return { result: "error" };
  }
}
