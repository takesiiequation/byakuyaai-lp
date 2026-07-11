import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const N8N_BASE = "https://aiboost-takeshi.app.n8n.cloud/webhook";
const BILLING_KEY = process.env.N8N_BILLING_KEY ?? "";
const RECON_KEY = process.env.N8N_RECON_KEY ?? "";

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

export interface InvoiceRow {
  番号: string;
  client_id: string;
  区分: string;
  対象月: string;
  本体: number;
  消費税: number;
  合計: number;
  発行日: string;
  送信先: string;
  発行時刻: string;
}

export interface PaymentRow {
  入金日: string;
  client_id: string;
  対象月: string;
  入金額: number;
  メモ: string;
}

function parseRows<T>(rows: string[][], headers: string[]): T[] {
  return rows.map((row) => {
    const obj: Record<string, string | number> = {};
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const v = row[i] ?? "";
      if (["本体", "消費税", "合計", "入金額"].includes(h)) {
        obj[h] = Number(String(v).replace(/[^0-9.-]/g, "")) || 0;
      } else {
        obj[h] = v;
      }
    }
    return obj as unknown as T;
  });
}

export async function getInvoiceLog(): Promise<InvoiceRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "請求書ログ",
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    return parseRows<InvoiceRow>(rows.slice(1) as string[][], rows[0] as string[]);
  } catch {
    return [];
  }
}

export async function getPayments(): Promise<PaymentRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "入金記録",
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    return parseRows<PaymentRow>(rows.slice(1) as string[][], rows[0] as string[]);
  } catch {
    return [];
  }
}

export async function addPayment(payment: PaymentRow): Promise<void> {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "入金記録!A:A",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        payment.入金日,
        payment.client_id,
        payment.対象月,
        payment.入金額,
        payment.メモ,
      ]],
    },
  });
}

export async function triggerInvoice(clientId: string, mode: "invoice" | "receipt", ym?: string): Promise<string> {
  const params = new URLSearchParams({ k: BILLING_KEY, client_id: clientId, mode });
  if (ym) params.set("ym", ym);
  const url = `${N8N_BASE}/billing-doc?${params}`;
  const res = await fetch(url, { method: "GET" });
  return res.ok ? "success" : `error: ${res.status}`;
}

export async function triggerReconcile(): Promise<string> {
  const url = `${N8N_BASE}/recon-run?k=${RECON_KEY}`;
  const res = await fetch(url, { method: "GET" });
  return res.ok ? "success" : `error: ${res.status}`;
}

export interface BillingEntry {
  client_id: string;
  client_name: string;
  対象月: string;
  plan: string;
  合計: number;
  入金額: number;
  status: "未入金" | "入金済" | "領収書済" | "過少" | "過大";
  invoice_num: string;
  発行日: string;
}

export function computeBillingStatus(
  invoices: InvoiceRow[],
  payments: PaymentRow[],
  clients: { client_id: string; client_name: string; plan: string }[]
): BillingEntry[] {
  const clientMap = new Map(clients.map((c) => [c.client_id, c]));
  const inv = invoices.filter((r) => r.区分 === "請求書");
  const rcp = invoices.filter((r) => r.区分 === "領収書");

  return inv.map((i) => {
    const paid = payments
      .filter((p) => p.client_id === i.client_id && p.対象月 === i.対象月)
      .reduce((s, p) => s + p.入金額, 0);
    const hasReceipt = rcp.some(
      (r) => r.client_id === i.client_id && r.対象月 === i.対象月
    );
    const c = clientMap.get(i.client_id);

    let status: BillingEntry["status"];
    if (hasReceipt) status = "領収書済";
    else if (paid === 0) status = "未入金";
    else if (paid < i.合計) status = "過少";
    else if (paid === i.合計) status = "入金済";
    else status = "過大";

    return {
      client_id: i.client_id,
      client_name: c?.client_name || i.client_id,
      対象月: i.対象月,
      plan: c?.plan || "",
      合計: i.合計,
      入金額: paid,
      status,
      invoice_num: i.番号,
      発行日: i.発行日,
    };
  });
}
