import { getPortalClientId } from "./portalAuth";
import { getClientById } from "./sheets";
import type { Client } from "./types";

// /api/portal/submit 系ルート共通の認証ガード。
// /portal ページと同じ二段構え: (1) 署名付きセッションcookie検証
// (2) 契約社シートから portal_enabled を毎リクエスト再検証(発行後に
// 管理側がOFFにしたセッションを生かさない — read-time recompute 原則)。

export type PortalGuard =
  | { ok: true; client: Client }
  | { ok: false; status: number; error: string };

export async function requirePortalClient(): Promise<PortalGuard> {
  const clientId = await getPortalClientId();
  if (!clientId) {
    return { ok: false, status: 401, error: "ログインが必要です" };
  }
  let client: Client | null = null;
  try {
    client = await getClientById(clientId);
  } catch {
    return { ok: false, status: 500, error: "顧客情報の取得に失敗しました。時間をおいて再度お試しください" };
  }
  if (!client || client.portal_enabled !== "true") {
    return { ok: false, status: 403, error: "マイページをご利用いただけません。担当者までご連絡ください" };
  }
  return { ok: true, client };
}
