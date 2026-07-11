"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ClientLite {
  client_id: string;
  client_name: string;
  line_data_sheet_id: string;
}

// Controlled textarea that grows with its content instead of scrolling
// internally — the natural shape for free-form knowledge-base cells.
function AutoTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className="w-full min-w-[180px] resize-none overflow-hidden border border-gray-200 bg-gray-50 rounded-lg px-2.5 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors"
    />
  );
}

export default function LineKnowledgeClient() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [originalRows, setOriginalRows] = useState<string[][]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const hasChanges = JSON.stringify(rows) !== JSON.stringify(originalRows);

  // --- 顧客一覧の取得 ------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        if (data.ok) {
          const list = data.data as ClientLite[];
          setClients(list);
          const firstConnected = list.find((c) => c.line_data_sheet_id);
          if (firstConnected) setSelectedClientId(firstConnected.client_id);
        } else {
          setClientsError(data.error || "顧客一覧の取得に失敗しました");
        }
      } catch (e) {
        setClientsError(String(e));
      }
      setClientsLoading(false);
    })();
  }, []);

  // --- ナレッジの取得 -------------------------------------------------------
  const loadKnowledge = useCallback(async (clientId: string) => {
    setKnowledgeLoading(true);
    setKnowledgeError("");
    setMsg(null);
    try {
      const res = await fetch(
        `/api/line/knowledge?clientId=${encodeURIComponent(clientId)}`
      );
      const data = await res.json();
      if (data.ok) {
        const h = (data.data.headers as string[]) || [];
        const r = (data.data.rows as string[][]) || [];
        setHeaders(h);
        setRows(r);
        setOriginalRows(r);
        if (h.length === 0) {
          setKnowledgeError("ナレッジタブが見つかりません");
        }
      } else {
        setHeaders([]);
        setRows([]);
        setOriginalRows([]);
        setKnowledgeError(data.error || "取得に失敗しました");
      }
    } catch (e) {
      setHeaders([]);
      setRows([]);
      setOriginalRows([]);
      setKnowledgeError(String(e));
    }
    setKnowledgeLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClientId) loadKnowledge(selectedClientId);
  }, [selectedClientId, loadKnowledge]);

  // --- 離脱警告(未保存の変更がある場合) ------------------------------------
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!hasChanges) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  function handleSelectClient(nextId: string) {
    if (hasChanges) {
      const ok = window.confirm(
        "保存されていない変更があります。破棄して移動しますか?"
      );
      if (!ok) return;
    }
    setSelectedClientId(nextId);
  }

  function setCell(rowIdx: number, colIdx: number, value: string) {
    setRows((rs) => {
      const next = rs.map((r) => r.slice());
      next[rowIdx][colIdx] = value;
      return next;
    });
    setMsg(null);
  }

  function addRow() {
    setRows((rs) => [...rs, headers.map(() => "")]);
    setMsg(null);
  }

  function confirmDeleteRow() {
    if (deleteIndex === null) return;
    setRows((rs) => rs.filter((_, i) => i !== deleteIndex));
    setDeleteIndex(null);
    setMsg(null);
  }

  async function doSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/line/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId, rows }),
      });
      const data = await res.json();
      if (data.ok) {
        setOriginalRows(rows);
        setMsg({ text: "保存しました。Botの次の応答から反映されます", ok: true });
      } else {
        setMsg({ text: data.error || "保存に失敗しました", ok: false });
      }
    } catch (e) {
      setMsg({ text: String(e), ok: false });
    }
    setSaving(false);
    setShowSaveConfirm(false);
  }

  const selectedClient = clients.find((c) => c.client_id === selectedClientId);

  return (
    <div className="space-y-4 sm:space-y-6 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          LINE設定
        </h1>
        {hasChanges && (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 shrink-0">
            未保存の変更
          </span>
        )}
      </div>

      {clientsError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm break-all">
          {clientsError}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          顧客を選択
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => handleSelectClient(e.target.value)}
          disabled={clientsLoading || clients.length === 0}
          className="w-full sm:w-96 border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors disabled:opacity-50"
        >
          {!selectedClientId && (
            <option value="" disabled>
              {clientsLoading ? "読み込み中..." : "選択してください"}
            </option>
          )}
          {clients.map((c) => (
            <option
              key={c.client_id}
              value={c.client_id}
              disabled={!c.line_data_sheet_id}
            >
              {c.client_name || c.client_id}
              {!c.line_data_sheet_id ? "(未接続)" : ""}
            </option>
          ))}
        </select>
        {!clientsLoading && clients.length === 0 && !clientsError && (
          <p className="text-sm text-gray-400 mt-2">顧客が登録されていません</p>
        )}
      </div>

      {selectedClient && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-2">
            <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
              LINEナレッジ
            </h2>
            {headers.length > 0 && (
              <button
                onClick={addRow}
                className="text-xs font-semibold text-[var(--brand-orange)] hover:text-[var(--brand-orange-dark)] transition-colors"
              >
                + 行を追加
              </button>
            )}
          </div>

          {knowledgeLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              読み込み中...
            </div>
          ) : knowledgeError ? (
            <div className="p-6 text-sm text-gray-500 bg-gray-50 m-4 sm:m-6 rounded-xl text-center">
              {knowledgeError}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    {headers.map((h, i) => (
                      <th
                        key={i}
                        className="text-left px-3 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap bg-gray-50"
                      >
                        {h || `列${i + 1}`}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 bg-gray-50 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={headers.length + 1}
                        className="px-4 py-8 text-center text-gray-400 text-sm"
                      >
                        行がありません。「+ 行を追加」から作成してください
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-gray-50 align-top">
                        {headers.map((_, ci) => (
                          <td key={ci} className="px-2 py-2">
                            <AutoTextarea
                              value={row[ci] ?? ""}
                              onChange={(v) => setCell(ri, ci, v)}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => setDeleteIndex(ri)}
                            className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedClient && headers.length > 0 && (
        <>
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={() => setShowSaveConfirm(true)}
              disabled={saving || !hasChanges}
              className="bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-8 py-2.5 text-sm hover:shadow-lg hover:shadow-[var(--brand-orange)]/25 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              保存する
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
              onClick={() => setShowSaveConfirm(true)}
              disabled={saving || !hasChanges}
              className="w-full bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-4 py-3.5 text-base shadow-lg shadow-[var(--brand-orange)]/20 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {hasChanges ? "変更を保存" : "変更なし"}
            </button>
          </div>
        </>
      )}

      {/* 保存前の確認モーダル */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-[var(--brand-ink)] mb-2">
              保存しますか?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Botの次の応答から反映されます。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveConfirm(false)}
                disabled={saving}
                className="text-gray-500 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={doSave}
                disabled={saving}
                className="bg-[var(--brand-orange)] text-white font-semibold rounded-xl px-4 py-2 text-sm hover:bg-[var(--brand-orange-dark)] disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 行削除の確認モーダル */}
      {deleteIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-[var(--brand-ink)] mb-2">
              行を削除しますか?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              この行の内容は保存するまで確定しません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteIndex(null)}
                className="text-gray-500 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDeleteRow}
                className="bg-red-500 text-white font-semibold rounded-xl px-4 py-2 text-sm hover:bg-red-600 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
