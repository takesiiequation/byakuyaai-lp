import { cookies } from "next/headers";
import { createHmac, randomUUID } from "crypto";

const SECRET = () => process.env.ADMIN_SESSION_SECRET || "dev-secret";
const API_KEY = () => process.env.ADMIN_API_KEY || "";

function sign(token: string): string {
  return createHmac("sha256", SECRET()).update(token).digest("hex");
}

export function createSession(): string {
  const token = randomUUID();
  const sig = sign(token);
  return `${token}.${sig}`;
}

export function verifySession(value: string): boolean {
  const [token, sig] = value.split(".");
  if (!token || !sig) return false;
  return sign(token) === sig;
}

export async function isAuthenticated(
  request?: Request
): Promise<boolean> {
  if (request) {
    const apiKey = request.headers.get("x-api-key");
    if (apiKey && API_KEY() && apiKey === API_KEY()) return true;
  }

  try {
    const jar = await cookies();
    const session = jar.get("admin-session")?.value;
    if (session && verifySession(session)) return true;
  } catch {
    // cookies() throws in API routes without cookie header
  }

  return false;
}

export async function requireAuth(request: Request): Promise<Response | null> {
  if (await isAuthenticated(request)) return null;
  return Response.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 }
  );
}
