import { NextRequest } from "next/server";
import { getAllClients } from "@/app/_lib/sheets";
import { createPortalSession } from "@/app/_lib/portalAuth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    client_id?: unknown;
    password?: unknown;
  };
  const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!clientId || !password) {
    return Response.json(
      { ok: false, error: "IDとパスワードを入力してください" },
      { status: 400 }
    );
  }

  let client;
  try {
    const clients = await getAllClients();
    client = clients.find((c) => c.client_id === clientId);
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }

  // AND gate (mirrors portfolio_enabled): both the explicit opt-in flag AND
  // a matching, non-empty password must hold. An empty portal_password
  // column must never "match" an empty submitted password.
  const enabled = client?.portal_enabled === "true";
  const passwordOk =
    !!client?.portal_password && password === client.portal_password;
  if (!client || !enabled || !passwordOk) {
    return Response.json(
      { ok: false, error: "IDまたはパスワードが違います" },
      { status: 401 }
    );
  }

  let session: string;
  try {
    session = createPortalSession(clientId);
  } catch {
    // PORTAL_SESSION_SECRET unset — fail-closed, never issue an unsigned/
    // guessable session.
    return Response.json(
      { ok: false, error: "サーバー設定エラー(ポータルが未設定です)" },
      { status: 500 }
    );
  }

  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `portal-session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`
  );
  return res;
}
