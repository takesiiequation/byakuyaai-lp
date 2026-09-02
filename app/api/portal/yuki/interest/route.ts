// 「話を聞いてみる」= 未開放の顧客からの関心表明。Discordで岡本に伝えるだけ。
// メール自動送信は絶対にしない(恒久ルール)。
import { NextResponse } from "next/server";
import { getPortalClientId } from "@/app/_lib/portalAuth";
import { getClientById } from "@/app/_lib/sheets";

export const maxDuration = 30;

export async function POST() {
  const clientId = await getPortalClientId();
  if (!clientId) return NextResponse.json({ ok: false }, { status: 401 });
  const client = await getClientById(clientId);
  const url = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_FEEDBACK_WEBHOOK;
  if (url && client) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `💡 ユキのデスクに関心表明: ${client.client_name}(${clientId}・plan=${client.plan})`,
        allowed_mentions: { parse: [] },
      }),
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
