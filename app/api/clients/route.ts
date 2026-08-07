import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getAllClients, addClient } from "@/app/_lib/sheets";
import type { Client } from "@/app/_lib/types";

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const clients = await getAllClients();
    const safe = clients.map(
      ({ secret_key, line_channel_token, line_channel_secret, portal_password, ...rest }) => ({
        ...rest,
        secret_key: secret_key ? "***" : "",
        line_channel_token: line_channel_token ? "***" : "",
        line_channel_secret: line_channel_secret ? "***" : "",
        // Same masking treatment as the other 3 secrets above — portal_password
        // is a plaintext credential distributed to a client, not something
        // this list view should echo back in the clear.
        portal_password: portal_password ? "***" : "",
      })
    );
    return Response.json({ ok: true, data: safe });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const body = (await req.json()) as Partial<Client>;
    if (!body.client_id || !body.client_name) {
      return Response.json(
        { ok: false, error: "client_id and client_name are required" },
        { status: 400 }
      );
    }
    const existing = await getAllClients();
    if (existing.some((c) => c.client_id === body.client_id)) {
      return Response.json(
        { ok: false, error: "client_id already exists" },
        { status: 409 }
      );
    }
    const client: Client = {
      client_id: body.client_id,
      secret_key: body.secret_key || "",
      client_name: body.client_name,
      plan: body.plan || "standard",
      tone: body.tone || "casual",
      monthly_quota: body.monthly_quota || 10,
      used_this_month: 0,
      quota_reset: "",
      publer_ig_account_id: body.publer_ig_account_id || "",
      publer_tt_account_id: body.publer_tt_account_id || "",
      notify_email: body.notify_email || "",
      status: body.status || "trial",
      next_post_slot: "",
      require_approval: body.require_approval || "",
      approval_email: body.approval_email || "",
      line_channel_token: body.line_channel_token || "",
      line_channel_secret: body.line_channel_secret || "",
      line_bot_user_id: body.line_bot_user_id || "",
      line_data_sheet_id: body.line_data_sheet_id || "",
      link_hp_url: body.link_hp_url || "",
      link_line_url: body.link_line_url || "",
      drive_folder_id: body.drive_folder_id || "",
      // portal_password/portal_enabled are set later by Okamoto during
      // portal onboarding (not part of the initial client-creation form) —
      // default to disabled, mirroring portfolio_enabled's fail-safe default.
      portal_password: body.portal_password || "",
      portal_enabled: body.portal_enabled || "",
      // license_number/transaction_type_default/portfolio_slug/
      // portfolio_enabled/line_staff_user_ids: same story as portal_* above
      // — set later during /f onboarding, not part of initial creation.
      license_number: body.license_number || "",
      // report_enabled: プランと独立の月次レポート配信フラグ(2026-08-01)。
      // 新規作成時はプランがpremiumなら配信ON(従来挙動の踏襲)、それ以外OFF。
      report_enabled: (body.plan || "standard") === "premium" ? "true" : "",
      invoice_enabled: "",
      line_notify_email: "",
      quota_no_reset: "",
      transaction_type_default: body.transaction_type_default || "",
      portfolio_slug: body.portfolio_slug || "",
      portfolio_enabled: body.portfolio_enabled || "",
      line_staff_user_ids: body.line_staff_user_ids || "",
    };
    await addClient(client);
    return Response.json({ ok: true, data: { client_id: client.client_id } });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
