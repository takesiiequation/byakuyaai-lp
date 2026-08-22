import { cookies } from "next/headers";
import { ME_COOKIE } from "@/app/_lib/meAuth";

export async function POST() {
  const jar = await cookies();
  jar.delete(ME_COOKIE);
  return Response.json({ ok: true });
}
