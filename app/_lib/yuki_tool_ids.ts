// デスクユキの道具の「外向きID」(2026-09-07 監査): 画面や承認カードに内部の道具名(仕入先や基盤が分かる)を出さず、不透明なIDで受け渡す
//   制御面→画面: toolId(name) / 画面→制御面(承認): toolName(id)
const IDS: Record<string, string> = {
  mcp__byakuyaai__memory_list: "t01", mcp__byakuyaai__memory_read: "t02", mcp__byakuyaai__memory_write: "t03",
  mcp__byakuyaai__video_list: "t04", mcp__byakuyaai__video_info: "t05", mcp__byakuyaai__layout_lint: "t06", mcp__byakuyaai__props_lint: "t07",
  mcp__byakuyaai__credits_balance: "t08", mcp__byakuyaai__render_lambda: "t09", mcp__byakuyaai__seedance_regenerate: "t10",
  mcp__byakuyaai__image_list: "t11", mcp__byakuyaai__image_generate: "t12", mcp__byakuyaai__image_edit: "t13", mcp__byakuyaai__human_support: "t14",
  Read: "f1", Write: "f2", Edit: "f3", MultiEdit: "f3", Glob: "f4", Grep: "f5", ToolSearch: "x0",
};
const NAMES: Record<string, string> = Object.fromEntries(Object.entries(IDS).filter(([k]) => k.startsWith("mcp__")).map(([k, v]) => [v, k]));
export const toolId = (name: string): string => IDS[name] || (name.startsWith("mcp__byakuyaai__") ? "t99" : "f9");
/** 承認で戻ってくるIDを内部名に(課金道具だけ)。不明なら "" */
export const toolName = (id: string): string => NAMES[id] || "";
