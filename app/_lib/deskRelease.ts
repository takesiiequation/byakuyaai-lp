// ユキのデスクの公開スイッチ(2026-09-02 岡本「まだ解放しないよ」)
// 個社フラグ(workspace_enabled)の**手前**に置く全体スイッチ。
//   - false: テスト顧客(plan=test)だけが見える。本番顧客にはマイページのカードも出さない
//   - true : 個社フラグ(workspace_enabled)に従う
// 公開時はこの1行を true にしてデプロイする。個社の試験開放はフラグ側で行う。
export const DESK_RELEASED = false;

export function deskVisibleFor(plan: string | undefined): boolean {
  return DESK_RELEASED || plan === "test";
}
