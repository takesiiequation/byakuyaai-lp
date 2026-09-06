import { cookies } from "next/headers";
import { createHmac, randomUUID } from "crypto";

// Client-portal session helper (/portal). Same shape as auth.ts, but a fully
// separate secret/cookie namespace from the admin session — internal
// (Okamoto-only) and external (distributed-to-clients) sessions must not
// share a key, so that a leak of one never lets an attacker forge the other
// (docs/property_db_f_design.md §P1.1).
//
// Deliberately only ONE env var name (PORTAL_SESSION_SECRET) — unlike
// auth.ts's ADMIN_SESSION_SECRET/SESSION_SECRET dual-name fallback (a
// historical accident from before this file existed), there is no legacy
// deployment to stay compatible with here. Fail-closed: unset -> every
// sign/verify throws, which the callers below turn into "not authenticated"
// rather than a 500.
const SECRET = () => {
  const s = process.env.PORTAL_SESSION_SECRET;
  if (!s) {
    throw new Error(
      "PORTAL_SESSION_SECRET is not set — refusing to sign/verify portal sessions"
    );
  }
  return s;
};

function sign(clientId: string, token: string): string {
  return createHmac("sha256", SECRET()).update(`${clientId}.${token}`).digest("hex");
}

/** Cookie value: `${client_id}.${token}.${sig}`. client_id is part of the
 * signed payload (not just a lookup key), so forging a session for a
 * *different* client_id requires PORTAL_SESSION_SECRET itself — a tampered
 * cookie can never widen its own access. */
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // 発行から7日で失効(監査 2026-09-07: 期限が無く失効させる手段が無かった)
export function createPortalSession(clientId: string): string {
  const token = `t${Date.now().toString(36)}-${randomUUID()}`;  // 先頭に発行時刻(base36)を焼く。旧形式(素のUUID)は verify で失効扱い
  const sig = sign(clientId, token);
  return `${clientId}.${token}.${sig}`;
}

export type PortalSessionCheck =
  | { ok: true; clientId: string }
  | { ok: false };

/** Parses from the right (lastIndexOf) rather than a plain split(".") so a
 * client_id that itself happens to contain a "." still round-trips. Never
 * throws: an unset PORTAL_SESSION_SECRET makes sign() throw internally,
 * which this function turns into `{ ok: false }` — fail-closed, not a crash. */
export function verifyPortalSession(value: string): PortalSessionCheck {
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return { ok: false };
  const sig = value.slice(lastDot + 1);
  const rest = value.slice(0, lastDot);
  const secondDot = rest.lastIndexOf(".");
  if (secondDot === -1) return { ok: false };
  const clientId = rest.slice(0, secondDot);
  const token = rest.slice(secondDot + 1);
  if (!clientId || !token || !sig) return { ok: false };

  try {
    if (sign(clientId, token) !== sig) return { ok: false };
  } catch {
    return { ok: false };
  }
  // 発行時刻の検査: 旧形式(時刻なし)と7日超は失効。ログインし直せばよい
  const m = /^t([0-9a-z]{6,12})-/.exec(token);
  if (!m) return { ok: false };
  const issued = parseInt(m[1], 36);
  if (!Number.isFinite(issued) || Date.now() - issued > SESSION_MAX_AGE_MS || issued > Date.now() + 60_000) return { ok: false };
  return { ok: true, clientId };
}

/** Reads+verifies the portal-session cookie for the current request. Never
 * throws (cookies() itself can throw outside a request context — caught the
 * same way auth.ts's isAuthenticated does). Returns null for "not logged
 * in" and "session invalid/tampered/expired-secret" alike — callers don't
 * need to distinguish those, they all mean "send to /portal/login". */
export async function getPortalClientId(): Promise<string | null> {
  try {
    const jar = await cookies();
    const session = jar.get("portal-session")?.value;
    if (!session) return null;
    const result = verifyPortalSession(session);
    return result.ok ? result.clientId : null;
  } catch {
    return null;
  }
}
