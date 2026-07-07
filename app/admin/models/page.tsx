"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PLAN_KEYS,
  PLAN_SLOT_LABELS,
  REQUIRED_PLACEHOLDERS,
  OPTIONAL_PLACEHOLDERS,
  type ModelDef,
} from "@/app/_lib/types";

type FormState = {
  model_id: string;
  label: string;
  endpoint_url: string;
  body_template: string;
  duration: string;
  resolution: string;
  notes: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  model_id: "",
  label: "",
  endpoint_url: "",
  body_template: "",
  duration: "",
  resolution: "",
  notes: "",
  active: true,
};

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelDef[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");

  const [planAssign, setPlanAssign] = useState<Record<string, string>>({});
  const [planForm, setPlanForm] = useState<Record<string, string>>({});
  const [planSaving, setPlanSaving] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [assistAvailable, setAssistAvailable] = useState(false);
  const [assistUrl, setAssistUrl] = useState("");
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistMsg, setAssistMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ModelDef | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const fetchModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.ok) {
        setModels(data.data);
      } else {
        setModelsError(data.error || "取得に失敗しました");
      }
    } catch (e) {
      setModelsError(String(e));
    }
    setModelsLoading(false);
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/models/plans");
      const data = await res.json();
      if (data.ok) {
        setPlanAssign(data.data);
        setPlanForm(data.data);
      }
    } catch {
      // 表示上は空のまま(下の保存フォームで再取得可能)
    }
  }, []);

  const fetchAssistAvailability = useCallback(async () => {
    try {
      const res = await fetch("/api/models/assist");
      const data = await res.json();
      if (data.ok) setAssistAvailable(!!data.data.available);
    } catch {
      setAssistAvailable(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchPlans();
    fetchAssistAvailability();
  }, [fetchModels, fetchPlans, fetchAssistAvailability]);

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setAssistUrl("");
    setAssistMsg(null);
    setFormOpen(true);
  }

  function openEditForm(m: ModelDef) {
    setEditingId(m.model_id);
    setForm({
      model_id: m.model_id,
      label: m.label,
      endpoint_url: m.endpoint_url,
      body_template: prettyJson(m.body_template),
      duration: m.duration,
      resolution: m.resolution,
      notes: m.notes,
      active: m.active,
    });
    setFormError("");
    setAssistUrl("");
    setAssistMsg(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function validateClientSide(): string | null {
    if (!form.model_id.trim()) return "model_idは必須です";
    if (!form.label.trim()) return "labelは必須です";
    if (!form.endpoint_url.trim()) return "endpoint_urlは必須です";
    if (!/^https?:\/\//i.test(form.endpoint_url.trim())) {
      return "endpoint_urlはhttp(s)で始まるURLである必要があります";
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(form.body_template);
    } catch {
      return "body_templateが正しいJSON形式ではありません";
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "body_templateはJSONオブジェクトである必要があります";
    }
    const missing = REQUIRED_PLACEHOLDERS.filter((p) => !form.body_template.includes(p));
    if (missing.length) {
      return `必須プレースホルダが不足しています: ${missing.join(", ")}`;
    }
    return null;
  }

  async function submitForm() {
    const clientError = validateClientSide();
    if (clientError) {
      setFormError(clientError);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/models", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                model_id: editingId,
                label: form.label.trim(),
                endpoint_url: form.endpoint_url.trim(),
                body_template: form.body_template.trim(),
                duration: form.duration,
                resolution: form.resolution,
                notes: form.notes,
                active: form.active,
              }
            : {
                model_id: form.model_id.trim(),
                label: form.label.trim(),
                endpoint_url: form.endpoint_url.trim(),
                body_template: form.body_template.trim(),
                duration: form.duration,
                resolution: form.resolution,
                notes: form.notes,
                active: form.active,
              }
        ),
      });
      const data = await res.json();
      if (data.ok) {
        setFormOpen(false);
        fetchModels();
      } else {
        setFormError(data.error || "保存に失敗しました");
      }
    } catch (e) {
      setFormError(String(e));
    }
    setSaving(false);
  }

  async function toggleActive(m: ModelDef) {
    setModels((ms) =>
      ms.map((x) => (x.model_id === m.model_id ? { ...x, active: !x.active } : x))
    );
    try {
      const res = await fetch("/api/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_id: m.model_id, active: !m.active }),
      });
      const data = await res.json();
      if (!data.ok) {
        setModels((ms) =>
          ms.map((x) => (x.model_id === m.model_id ? { ...x, active: m.active } : x))
        );
        setModelsError(data.error || "更新に失敗しました");
      }
    } catch (e) {
      setModels((ms) =>
        ms.map((x) => (x.model_id === m.model_id ? { ...x, active: m.active } : x))
      );
      setModelsError(String(e));
    }
  }

  function usedByPlans(modelId: string): string[] {
    return Object.entries(planAssign)
      .filter(([, id]) => id === modelId)
      .map(([plan]) => (PLAN_SLOT_LABELS as Record<string, string>)[plan] || plan);
  }

  function openDelete(m: ModelDef) {
    setDeleteTarget(m);
    setDeleteMsg("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const blockers = usedByPlans(deleteTarget.model_id);
    if (blockers.length > 0) return;
    setDeleting(true);
    setDeleteMsg("");
    try {
      const res = await fetch(
        `/api/models?model_id=${encodeURIComponent(deleteTarget.model_id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.ok) {
        setModels((ms) => ms.filter((x) => x.model_id !== deleteTarget.model_id));
        setDeleteTarget(null);
      } else {
        setDeleteMsg(data.error || "削除に失敗しました");
      }
    } catch (e) {
      setDeleteMsg(String(e));
    }
    setDeleting(false);
  }

  async function runAssist() {
    if (!assistUrl.trim()) return;
    setAssistLoading(true);
    setAssistMsg(null);
    try {
      const res = await fetch("/api/models/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: assistUrl.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setForm((f) => ({
          ...f,
          endpoint_url: data.data.endpoint_url || f.endpoint_url,
          duration: data.data.duration || f.duration,
          resolution: data.data.resolution || f.resolution,
          body_template: data.data.body_template
            ? prettyJson(data.data.body_template)
            : f.body_template,
          notes: data.data.notes || f.notes,
        }));
        setAssistMsg({
          text: "自動入力しました。内容を確認して保存してください",
          ok: true,
        });
      } else {
        setAssistMsg({ text: data.error || "自動入力に失敗しました", ok: false });
      }
    } catch (e) {
      setAssistMsg({ text: String(e), ok: false });
    }
    setAssistLoading(false);
  }

  async function savePlans() {
    setPlanSaving(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/models/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm),
      });
      const data = await res.json();
      if (data.ok) {
        setPlanAssign(planForm);
        setPlanMsg({ text: "保存しました", ok: true });
      } else {
        setPlanMsg({ text: data.error || "保存に失敗しました", ok: false });
      }
    } catch (e) {
      setPlanMsg({ text: String(e), ok: false });
    }
    setPlanSaving(false);
  }

  const planHasChanges = JSON.stringify(planForm) !== JSON.stringify(planAssign);

  return (
    <div className="space-y-4 sm:space-y-6 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          モデル管理
        </h1>
        <button
          onClick={openNewForm}
          className="shrink-0 bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm hover:shadow-lg transition-all active:scale-[0.98]"
        >
          + モデルを追加
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm px-4 py-2.5 rounded-xl">
        ここで登録したモデルとプラン割当は、n8n側が今後読み込む予定のデータです(本番ワークフローは今回のスコープ外)。
      </div>

      {/* --- モデル一覧 --- */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            登録済みモデル
          </h2>
        </div>

        {modelsError && (
          <div className="m-4 sm:m-6 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {modelsError}
          </div>
        )}

        {modelsLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : models.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            モデルがまだ登録されていません
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {models.map((m) => {
              const usedBy = usedByPlans(m.model_id);
              return (
                <div
                  key={m.model_id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--brand-ink)]">
                        {m.label || m.model_id}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                        {m.model_id}
                      </span>
                      {usedBy.length > 0 && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                          使用中: {usedBy.join(" / ")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      {m.endpoint_url}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {m.duration ? `${m.duration}秒` : "-"} ·{" "}
                      {m.resolution || "-"}
                      {m.notes ? ` · ${m.notes}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(m)}
                      className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
                        m.active
                          ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                          : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      {m.active ? "有効" : "無効"}
                    </button>
                    <button
                      onClick={() => openEditForm(m)}
                      className="text-xs font-medium text-gray-600 hover:text-[var(--brand-orange)] px-2 py-1.5 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => openDelete(m)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1.5 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- プラン割当 --- */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            プラン割当
          </h2>
        </div>
        <div className="p-4 sm:p-6 space-y-3">
          {PLAN_KEYS.map((plan) => (
            <div key={plan} className="flex items-center gap-3">
              <label className="w-24 shrink-0 text-sm font-medium text-gray-600">
                {PLAN_SLOT_LABELS[plan]}
              </label>
              <select
                value={planForm[plan] ?? ""}
                onChange={(e) =>
                  setPlanForm((p) => ({ ...p, [plan]: e.target.value }))
                }
                className="flex-1 border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors appearance-none"
              >
                <option value="">未設定</option>
                {models.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.label || m.model_id}
                    {!m.active ? "(無効)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={savePlans}
              disabled={planSaving || !planHasChanges}
              className="bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-6 py-2.5 text-sm hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              {planSaving ? "保存中..." : "プラン割当を保存"}
            </button>
            {planMsg && (
              <span
                className={`text-sm font-medium ${planMsg.ok ? "text-green-600" : "text-red-500"}`}
              >
                {planMsg.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- 追加/編集フォーム --- */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-xl w-full my-auto">
            <h3 className="font-bold text-[var(--brand-ink)] mb-4">
              {editingId ? `モデルを編集: ${editingId}` : "モデルを追加"}
            </h3>

            {/* AI自動入力 */}
            <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                🤖 docs URLから自動入力
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={assistUrl}
                  onChange={(e) => setAssistUrl(e.target.value)}
                  placeholder="https://fal.ai/models/..."
                  disabled={!assistAvailable || assistLoading}
                  className="flex-1 border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] disabled:opacity-50"
                />
                <button
                  onClick={runAssist}
                  disabled={!assistAvailable || assistLoading || !assistUrl.trim()}
                  className="shrink-0 bg-[var(--brand-ink)] text-white font-semibold rounded-lg px-4 py-2 text-xs sm:text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {assistLoading ? "解析中..." : "自動入力"}
                </button>
              </div>
              {!assistAvailable && (
                <p className="text-xs text-amber-600 mt-1.5">
                  環境変数(OPENROUTER_API_KEY)が必要です
                </p>
              )}
              {assistMsg && (
                <p
                  className={`text-xs mt-1.5 ${assistMsg.ok ? "text-green-600" : "text-red-500"}`}
                >
                  {assistMsg.text}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">
                AIの出力はそのまま保存されません。下のフォームで確認・修正してから保存してください。
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  model_id
                </label>
                <input
                  type="text"
                  value={form.model_id}
                  disabled={!!editingId}
                  onChange={(e) => setForm((f) => ({ ...f, model_id: e.target.value }))}
                  placeholder="seedance_720p"
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  label
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  endpoint_url
                </label>
                <input
                  type="text"
                  value={form.endpoint_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endpoint_url: e.target.value }))
                  }
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    duration
                  </label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, duration: e.target.value }))
                    }
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    resolution
                  </label>
                  <input
                    type="text"
                    value={form.resolution}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, resolution: e.target.value }))
                    }
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  body_template (JSON)
                </label>
                <textarea
                  value={form.body_template}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body_template: e.target.value }))
                  }
                  rows={6}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  必須プレースホルダ: {REQUIRED_PLACEHOLDERS.join(" / ")}
                  <br />
                  任意プレースホルダ: {OPTIONAL_PLACEHOLDERS.join(" / ")}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 accent-[var(--brand-orange)]"
                />
                有効(active)
              </label>
            </div>

            {formError && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg break-words">
                {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={closeForm}
                disabled={saving}
                className="text-gray-500 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={submitForm}
                disabled={saving}
                className="bg-[var(--brand-orange)] text-white font-semibold rounded-xl px-5 py-2 text-sm hover:bg-[var(--brand-orange-dark)] disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 削除確認モーダル --- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            {usedByPlans(deleteTarget.model_id).length > 0 ? (
              <>
                <h3 className="font-bold text-[var(--brand-ink)] mb-2">
                  削除できません
                </h3>
                <p className="text-sm text-gray-500 mb-5 break-words">
                  「{deleteTarget.label || deleteTarget.model_id}」は現在プラン割当(
                  {usedByPlans(deleteTarget.model_id).join(" / ")})で使用中です。
                  先にプラン割当を変更してから削除してください。
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="bg-gray-100 text-gray-600 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-200 transition-colors"
                  >
                    閉じる
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-[var(--brand-ink)] mb-2">
                  削除しますか?
                </h3>
                <p className="text-sm text-gray-500 mb-5 break-words">
                  「{deleteTarget.label || deleteTarget.model_id}」を削除します。この操作は取り消せません。
                </p>
                {deleteMsg && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg break-words">
                    {deleteMsg}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="text-gray-500 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="bg-red-500 text-white font-semibold rounded-xl px-4 py-2 text-sm hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? "削除中..." : "削除する"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
