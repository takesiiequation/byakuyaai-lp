import { NextRequest } from "next/server";
import { createSession } from "@/app/_lib/auth";

export async function POST(req: NextRequest) {
  const { password } = (await req.json()) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    return Response.json(
      { ok: false, error: "Invalid password" },
      { status: 401 }
    );
  }

  const session = createSession();
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `admin-session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`
  );
  return res;
}
