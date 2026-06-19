"use client";

import { useState, useEffect, useCallback } from "react";

interface BillingEntry {
  client_id: string;
  client_name: string;
  対象月: string;
  plan: string;
  合計: number;
  入金額: number;
  status: string;
  invoice_num: string;
  発行日: string;
}

const STATUS_STYLE: Record<string, string> = {
  領収書済: "bg-green-50 text-green-700 border-green-200",
  入金済: "bg-blue-50 text-blue-700 border-blue-200",
  未入金: "bg-red-50 text-red-600 border-red-200",
  過少: "bg-amber-50 text-amber-700 border-amber-200",
  過大: "bg-purple-50 text-purple-700 border-purple-200",
};

const yen = (n: number) => "¥" + n.toLocaleString("ja-JP");

export default function BillingPage() {
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({
    client_id: "",
    month: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    memo: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/billing");
      const data = await res.json();
      if (data.ok) {
        setEntries(data.data.entries);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await fetch("/api/billing/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMsg({
          text: "入金を記録しました。照合を実行中...",
          ok: true,
        });
        setShowPayForm(false);
        setPayForm((f) => ({ ...f, client_id: "", month: "", amount: "", memo: "" }));
        setTimeout(fetchData, 3000);
      } else {
        setActionMsg({ text: data.error || "記録に失敗しました", ok: false });
      }
    } catch (e) {
      setActionMsg({ text: String(e), ok: false });
    }
    setSubmitting(false);
  }

  async function triggerAction(
    action: string,
    clientId?: string,
    month?: string
  ) {
    setActionMsg(null);
    try {
      const res = await fetch("/api/billing/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          client_id: clientId,
          month,
        }),
      });
      const data = await res.json();
      const label =
        action === "invoice"
          ? "請求書"
          : action === "receipt"
            ? "領収書"
            : "照合";
      if (data.ok) {
        setActionMsg({ text: `${label}を実行しました`, ok: true });
        setTimeout(fetchData, 3000);
      } else {
        setActionMsg({ text: data.error || `${label}に失敗`, ok: false });
      }
    } catch (e) {
      setActionMsg({ text: String(e), ok: false });
    }
  }

  const unpaidCount = entries.filter(
    (e) => e.status === "未入金" || e.status === "過少"
  ).length;
  const totalUnpaid = entries
    .filter((e) => e.status === "未入金" || e.status === "過少")
    .reduce((s, e) => s + (e.合計 - e.入金額), 0);

  const uniqueClients = [...new Set(entries.map((e) => e.client_id))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        読み込み中...
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          経理
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPayForm(!showPayForm)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl px-4 py-2 text-sm hover:shadow-lg active:scale-[0.98] transition-all"
          >
            + 入金記録
          </button>
          <button
            onClick={() => triggerAction("reconcile")}
            className="bg-gray-100 text-gray-600 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-200 active:scale-[0.98] transition-all"
          >
            照合実行
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`text-sm px-4 py-2.5 rounded-xl ${
            actionMsg.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {/* サマリー */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="text-xs text-gray-400">請求書数</div>
          <div className="text-xl font-bold text-[var(--brand-ink)] mt-1">
            {entries.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="text-xs text-gray-400">未入金</div>
          <div className="text-xl font-bold text-red-500 mt-1">
            {unpaidCount}件
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="text-xs text-gray-400">未回収額</div>
          <div className="text-xl font-bold text-red-500 mt-1">
            {yen(totalUnpaid)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
          <div className="text-xs text-gray-400">領収書済</div>
          <div className="text-xl font-bold text-green-600 mt-1">
            {entries.filter((e) => e.status === "領収書済").length}件
          </div>
        </div>
      </div>

      {/* 入金記録フォーム */}
      {showPayForm && (
        <form
          onSubmit={submitPayment}
          className="bg-white rounded-2xl border border-blue-200 overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b border-blue-100">
            <h2 className="font-bold text-xs text-blue-600 uppercase tracking-wider">
              入金記録
            </h2>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                顧客
              </label>
              <select
                value={payForm.client_id}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, client_id: e.target.value }))
                }
                required
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white appearance-none"
              >
                <option value="">選択してください</option>
                {uniqueClients.map((cid) => {
                  const e = entries.find((x) => x.client_id === cid);
                  return (
                    <option key={cid} value={cid}>
                      {e?.client_name || cid}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                対象月
              </label>
              <select
                value={payForm.month}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, month: e.target.value }))
                }
                required
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white appearance-none"
              >
                <option value="">選択してください</option>
                {[
                  ...new Set(
                    entries
                      .filter(
                        (e) =>
                          !payForm.client_id ||
                          e.client_id === payForm.client_id
                      )
                      .map((e) => e.対象月)
                  ),
                ].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                入金額 (税込)
              </label>
              <input
                type="number"
                value={payForm.amount}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, amount: e.target.value }))
                }
                required
                placeholder="110000"
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                入金日
              </label>
              <input
                type="date"
                value={payForm.date}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, date: e.target.value }))
                }
                required
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                メモ
              </label>
              <input
                type="text"
                value={payForm.memo}
                onChange={(e) =>
                  setPayForm((f) => ({ ...f, memo: e.target.value }))
                }
                placeholder="横浜銀行振込"
                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
              />
            </div>
          </div>
          <div className="px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl px-6 py-2.5 text-sm hover:shadow-lg disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {submitting ? "記録中..." : "入金を記録する"}
            </button>
            <button
              type="button"
              onClick={() => setShowPayForm(false)}
              className="text-gray-500 font-medium rounded-xl px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* 請求一覧テーブル */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            請求一覧
          </h2>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            請求書ログがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                    顧客
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs">
                    対象月
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">
                    請求額
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-gray-500 text-xs">
                    入金額
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-500 text-xs">
                    ステータス
                  </th>
                  <th className="text-center px-4 py-2.5 font-medium text-gray-500 text-xs">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={`${e.invoice_num}-${i}`}
                    className="border-b border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--brand-ink)]">
                      {e.client_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.対象月}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {yen(e.合計)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {e.入金額 > 0 ? yen(e.入金額) : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          STATUS_STYLE[e.status] ||
                          "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(e.status === "未入金" || e.status === "過少") && (
                        <button
                          onClick={() => {
                            setPayForm((f) => ({
                              ...f,
                              client_id: e.client_id,
                              month: e.対象月,
                              amount: String(e.合計 - e.入金額),
                            }));
                            setShowPayForm(true);
                          }}
                          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                        >
                          入金記録
                        </button>
                      )}
                      {e.status === "入金済" && (
                        <button
                          onClick={() =>
                            triggerAction("receipt", e.client_id, e.対象月)
                          }
                          className="text-xs text-green-500 hover:text-green-700 font-medium"
                        >
                          領収書発行
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
