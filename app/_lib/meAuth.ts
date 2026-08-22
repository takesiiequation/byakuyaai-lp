import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

// Personal-tracker session helper (/me). A THIRD, fully separate secret and
// cookie namespace from admin (auth.ts) and client-portal (portalAuth.ts):
// this one guards Okamoto's own health log, so a leak of either business
// secret must never grant access here, and vice versa. Same fail-closed
// shape as portalAuth.ts — an unset secret makes every sign/verify throw
// internally, which the helpers below turn into "not authenticated" rather
// than a 500.
const SECRET = () => {
  const s = process.env.ME_SESSION_SECRET;
  if (!s) {
    throw new Error(
      "ME_SESSION_SECRET is not set — refusing to sign/verify /me sessions"
    );
  }
  return s;
};

export const ME_COOKIE = "me-session";

function sign(token: string): string {
  return createHmac("sha256", SECRET()).update(token).digest("hex");
}

export function createMeSession(): string {
  const token = randomUUID();
  return `${token}.${sign(token)}`;
}

export function verifyMeSession(value: string): boolean {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;
  const token = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!token || !sig) return false;
  try {
    const expected = sign(token);
    if (expected.length !== sig.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

/** Constant-time PIN check. Fail-closed when ME_PIN is unset: with no PIN
 * configured there is no correct answer, so every attempt is rejected
 * rather than every attempt being accepted. */
export function checkPin(input: string): boolean {
  const pin = process.env.ME_PIN;
  if (!pin || !input) return false;
  const a = Buffer.from(pin);
  const b = Buffer.from(input);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function isMeAuthed(): Promise<boolean> {
  try {
    const jar = await cookies();
    const v = jar.get(ME_COOKIE)?.value;
    return !!v && verifyMeSession(v);
  } catch {
    return false;
  }
}
