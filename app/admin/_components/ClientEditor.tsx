"use client";

import { useState } from "react";
import type { Client } from "@/app/_lib/types";
import { PLAN_FEATURES, extractDriveFolderId } from "@/app/_lib/types";
// Type-only import: health.ts pulls in `googleapis` (Node-only), which must
// never reach this "use client" bundle — `import type` is erased entirely
// at compile time, so only the shape is used here, not the module.
import type { HealthCheckResult } from "@/app/_lib/health";

interface FieldDef {
  key: string;
  label: string;
  type?: string;
  sensitive?: boolean;
  options?: { value: string; label: string }[];
}

interface Section {
  title: string;
  fields: FieldDef[];
}

export default function ClientEditor({
  client,
  sections,
}: {
  client: Client;
  sections: Section[];
}) {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(client).map(([k, v]) => [k, String(v ?? "")])
    )
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [onboarding, setOnboarding] = useState(false);
  const [onboardResult, setOnboardResult] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(
    null
  );
  const [healthError, setHealthError] = useState("");

  const hasChanges = Object.entries(form).some(
    ([k, v]) =>
      v !== String((client as unknown as Record<string, unknown>)[k] ?? "")
  );

  const isOnboarded = !!client.line_data_sheet_id;

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const changed: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (
        v !==
        String((client as unknown as Record<string, unknown>)[k] ?? "")
      ) {
        changed[k] = v;
      }
    }
    if (Object.keys(changed).length === 0) {
      setMsg({ text: "変更がありません", ok: true });
      setSaving(false);
      return;
    }
    const res = await fetch(`/api/clients/${client.client_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changed),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? { text: "保存しました", ok: true }
        : { text: data.error || "保存に失敗しました", ok: false }
    );
    setSaving(false);
  }

  async function runOnboard() {
    setOnboarding(true);
    setOnboardResult(null);
    try {
      const res = await fetch(`/api/clients/${client.client_id}/onboard`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        let text = data.data.sheet_skipped
          ? "LINEデータシート: 既存"
          : "フォルダ + LINEデータシート: 作成完了";
        if (data.data.warning === "no_folder") {
          text += "(⚠️顧客フォルダが未指定だったため新規作成しました)";
        } else if (data.data.warning === "folder_permission") {
          text +=
            "(⚠️指定フォルダへの権限がなく、既定の場所に作成されました。サービスアカウントを編集者として共有してください)";
        }
        setOnboardResult({ ok: true, text });
        setForm((f) => ({
          ...f,
          ...(data.data.line_data_sheet_id
            ? { line_data_sheet_id: data.data.line_data_sheet_id }
            : {}),
          ...(data.data.client_folder_id
            ? { drive_folder_id: data.data.client_folder_id }
            : {}),
        }));
      } else {
        setOnboardResult({
          ok: false,
          text: data.error || "オンボーディングに失敗しました",
        });
      }
    } catch (e) {
      setOnboardResult({ ok: false, text: String(e) });
    }
    setOnboarding(false);
  }

  async function runHealthCheck() {
    setHealthChecking(true);
    setHealthError("");
    setHealthResult(null);
    try {
      const res = await fetch(`/api/clients/${client.client_id}/health`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setHealthResult(data.data as HealthCheckResult);
      } else {
        setHealthError(data.error || "健全性チェックに失敗しました");
      }
    } catch (e) {
      setHealthError(String(e));
    }
    setHealthChecking(false);
  }

  const currentPlan = form.plan || client.plan;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* プラン別機能バッジ */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            利用可能な機能
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLAN_FEATURES).map(([key, feat]) => {
              const active = feat.plans.includes(currentPlan);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
                    active
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  }`}
                >
                  <span className="text-[10px]">{active ? "●" : "○"}</span>
                  {feat.label}
                  {!active && (
                    <span className="text-[10px] text-gray-300 ml-0.5">
                      準備済
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* セットアップ状態(充足バッジ + 外部リンク) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            セットアップ状態
          </h2>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["line_channel_token", "チャネルアクセストークン"],
                ["line_channel_secret", "チャネルシークレット"],
                ["line_bot_user_id", "ボットユーザーID"],
                ["line_data_sheet_id", "LINEデータシート"],
                ["drive_folder_id", "顧客フォルダ"],
              ] as const
            ).map(([key, label]) => {
              const filled = !!client[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-gray-50 border-gray-200 text-gray-600"
                >
                  {label}
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      filled
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-gray-100 text-gray-400 border border-gray-200"
                    }`}
                  >
                    {filled ? "設定済み" : "未設定"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {client.line_data_sheet_id && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${client.line_data_sheet_id}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)] active:scale-95 transition-all"
              >
                データシートを開く ↗
              </a>
            )}
            {client.drive_folder_id && (
              <a
                href={`https://drive.google.com/drive/folders/${client.drive_folder_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-[var(--brand-orange)] hover:text-[var(--brand-orange)] active:scale-95 transition-all"
              >
                顧客フォルダを開く ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 健全性チェック */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            健全性チェック
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              LINEデータシートのタブ構成・ヘッダー・保存場所を検証します
            </p>
            <button
              onClick={runHealthCheck}
              disabled={healthChecking}
              className="shrink-0 font-semibold rounded-xl px-4 py-2.5 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {healthChecking ? "確認中..." : "健全性チェック"}
            </button>
          </div>
          {healthError && (
            <div className="mt-3 text-sm px-3 py-2 rounded-lg bg-red-50 text-red-600">
              {healthError}
            </div>
          )}
          {healthResult && (
            <ul className="mt-3 space-y-1.5">
              {healthResult.checks.map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="flex items-start gap-2">
                    <span className={c.ok ? "text-green-600" : "text-red-500"}>
                      {c.ok ? "✅" : "❌"}
                    </span>
                    <div>
                      <span
                        className={c.ok ? "text-gray-700" : "text-red-600"}
                      >
                        {c.label}
                      </span>
                      {c.detail && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {c.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* オンボーディング */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            セットアップ
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              {isOnboarded ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    セットアップ完了
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    LINEデータシート: {client.line_data_sheet_id}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600">
                    Driveフォルダ + LINEデータシートを自動作成します
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    フォーム複製とApps Scriptは手動で設定してください
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={runOnboard}
              disabled={onboarding}
              className={`shrink-0 font-semibold rounded-xl px-5 py-2.5 text-sm transition-all active:scale-[0.98] ${
                isOnboarded
                  ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25"
              } disabled:opacity-40`}
            >
              {onboarding
                ? "実行中..."
                : isOnboarded
                  ? "再実行"
                  : "セットアップ実行"}
            </button>
          </div>
          {onboardResult && (
            <div
              className={`mt-3 text-sm px-3 py-2 rounded-lg ${
                onboardResult.ok
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {onboardResult.text}
            </div>
          )}
        </div>
      </div>

      {/* 既存セクション */}
      {sections.map((s) => (
        <div
          key={s.title}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
              {s.title}
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {s.fields.map((f) => {
                const val = form[f.key] ?? "";
                const isSensitive =
                  f.sensitive && val && !revealed.has(f.key);

                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {f.label}
                    </label>
                    {f.type === "select" && f.options ? (
                      <select
                        value={val}
                        onChange={(e) => set(f.key, e.target.value)}
                        className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors appearance-none"
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="relative">
                        <input
                          type={
                            f.type === "number"
                              ? "number"
                              : isSensitive
                                ? "password"
                                : "text"
                          }
                          value={val}
                          onChange={(e) =>
                            set(
                              f.key,
                              f.type === "drive_folder"
                                ? extractDriveFolderId(e.target.value)
                                : e.target.value
                            )
                          }
                          placeholder={
                            f.type === "drive_folder"
                              ? "フォルダURLを貼り付け可"
                              : undefined
                          }
                          className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors pr-14"
                        />
                        {f.sensitive && val && (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealed((r) => {
                                const next = new Set(r);
                                next.has(f.key)
                                  ? next.delete(f.key)
                                  : next.add(f.key);
                                return next;
                              })
                            }
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-[var(--brand-orange)] bg-white border border-gray-200 rounded-lg px-2 py-1 transition-colors active:scale-95"
                          >
                            {isSensitive ? "表示" : "隠す"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <div className="hidden sm:flex items-center gap-4 pt-2">
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className="bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-8 py-2.5 text-sm hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        {msg && (
          <span
            className={`text-sm font-medium ${msg.ok ? "text-green-600" : "text-red-500"}`}
          >
            {msg.text}
          </span>
        )}
      </div>

      <div className="sm:hidden fixed bottom-14 left-0 right-0 z-30 px-4 pb-3 pt-2 bg-gradient-to-t from-gray-50 via-gray-50 to-gray-50/0">
        {msg && (
          <div
            className={`text-center text-sm font-medium mb-2 ${msg.ok ? "text-green-600" : "text-red-500"}`}
          >
            {msg.text}
          </div>
        )}
        <button
          onClick={save}
          disabled={saving || !hasChanges}
          className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-4 py-3.5 text-base shadow-lg shadow-[var(--brand-orange)]/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {saving ? "保存中..." : hasChanges ? "変更を保存" : "変更なし"}
        </button>
      </div>
    </div>
  );
}
