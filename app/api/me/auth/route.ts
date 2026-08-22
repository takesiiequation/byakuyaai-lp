import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkPin, createMeSession, ME_COOKIE } from "@/app/_lib/meAuth";

// Deliberately slow-ish failure path (no timing signal beyond the constant-
// time compare in checkPin) and a single generic error string — the PIN is
// short, so nothing here should help an attacker narrow it down.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { pin?: unknown };
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!pin) {
    return Response.json({ ok: false, error: "PINを入力してください" }, { status: 400 });
  }
  if (!checkPin(pin)) {
    return Response.json({ ok: false, error: "PINが違います" }, { status: 401 });
  }

  let session: string;
  try {
    session = createMeSession();
  } catch {
    return Response.json(
      { ok: false, error: "サーバー設定が未完了です（ME_SESSION_SECRET）" },
      { status: 500 }
    );
  }

  const jar = await cookies();
  jar.set(ME_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return Response.json({ ok: true });
}
