export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `portal-session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
  );
  return res;
}
