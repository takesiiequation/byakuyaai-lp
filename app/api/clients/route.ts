import { NextRequest } from "next/server";
import { requireAuth } from "@/app/_lib/auth";
import { getAllClients, addClient } from "@/app/_lib/sheets";
import type { Client } from "@/app/_lib/types";

export async function GET(req: NextRequest) {
  const denied = await requireAuth(req);
  if (denied) return denied;

  try {
    const clients = await getAllClients();
    const safe = clients.map(({ secret_key, line_channel_token, line_channel_secret, ...rest }) => ({
      ...rest,
      secret_key: secret_key ? "***" : "",
      line_channel_token: line_channel_token ? "***" : "",
      line_channel_secret: line_channel_secret ? "***" : "",
    }));
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
    if (!body.client_id || !body.company_name) {
      return Response.json(
        { ok: false, error: "client_id and company_name are required" },
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
      company_name: body.company_name,
      plan: body.plan || "standard",
      secret_key: body.secret_key || "",
      monthly_quota: body.monthly_quota || 10,
      used_this_month: 0,
      quota_reset: "",
      bgm_url: body.bgm_url || "",
      cover_image_url: body.cover_image_url || "",
      font_family: body.font_family || "",
      accent_color: body.accent_color || "",
      video_mode: body.video_mode || "",
      next_post_slot: "",
      require_approval: body.require_approval || "",
      approval_email: body.approval_email || "",
      line_channel_token: body.line_channel_token || "",
      line_channel_secret: body.line_channel_secret || "",
      line_bot_user_id: body.line_bot_user_id || "",
      line_data_sheet_id: body.line_data_sheet_id || "",
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
