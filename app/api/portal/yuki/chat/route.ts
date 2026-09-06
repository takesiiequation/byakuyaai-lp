// 旧・ユキのデスク チャットAPI(2026-09-02 OpenRouter版)。2026-09-07 の監査で「台帳・承認ゲート・法律を素通りする旧経路」と判定→閉鎖。
// 現行は /api/portal/yuki/run(Fargateランタイム)。復活させる時は git 履歴から。
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "この窓口は終了しました。ユキのデスクからご相談ください" }, { status: 410 });
}
