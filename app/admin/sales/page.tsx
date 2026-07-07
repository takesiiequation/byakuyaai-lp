"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type SortDir = "asc" | "desc";

interface SalesApiData {
  tabs: string[];
  activeTab: string;
  headers: string[];
  rows: string[][];
}

export default function SalesPage() {
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const fetchTab = useCallback(async (tab?: string) => {
    setLoading(true);
    setError("");
    try {
      const url = tab ? `/api/sales?tab=${encodeURIComponent(tab)}` : "/api/sales";
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        const d = data.data as SalesApiData;
        setTabs(d.tabs);
        setActiveTab(d.activeTab);
        setHeaders(d.headers);
        setRows(d.rows);
      } else {
        setError(data.error || "取得に失敗しました");
        setTabs([]);
        setHeaders([]);
        setRows([]);
      }
    } catch (e) {
      setError(String(e));
      setTabs([]);
      setHeaders([]);
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTab(tab: string) {
    if (tab === activeTab) return;
    setQuery("");
    setSortCol(null);
    fetchTab(tab);
  }

  function toggleSort(col: number) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filteredRows = useMemo(() => {
    let out = rows;

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => r.some((c) => c.toLowerCase().includes(q)));
    }

    if (sortCol !== null) {
      const col = sortCol;
      out = [...out].sort((a, b) => {
        const av = a[col] ?? "";
        const bv = b[col] ?? "";
        const an = Number(av);
        const bn = Number(bv);
        let cmp: number;
        if (av !== "" && bv !== "" && !Number.isNaN(an) && !Number.isNaN(bn)) {
          cmp = an - bn;
        } else {
          cmp = av.localeCompare(bv, "ja");
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return out;
  }, [rows, query, sortCol, sortDir]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          営業リスト
        </h1>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2.5 py-1 shrink-0">
          読み取り専用
        </span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {tabs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                t === activeTab
                  ? "bg-[var(--brand-orange)] text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="全列を検索..."
            disabled={loading || headers.length === 0}
            className="w-full sm:w-64 border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] disabled:opacity-50"
          />
          <span className="text-xs text-gray-400 shrink-0">
            {loading ? "..." : `${filteredRows.length}件 / 全${rows.length}件`}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : headers.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            データがありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      onClick={() => toggleSort(i)}
                      className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs cursor-pointer select-none hover:text-[var(--brand-orange)] whitespace-nowrap"
                    >
                      {h || `列${i + 1}`}
                      {sortCol === i ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={headers.length}
                      className="px-4 py-8 text-center text-gray-400 text-sm"
                    >
                      該当する行がありません
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, ri) => (
                    <tr
                      key={ri}
                      className="border-b border-gray-50 hover:bg-gray-50/50"
                    >
                      {headers.map((_, ci) => (
                        <td
                          key={ci}
                          className="px-4 py-3 text-gray-700 whitespace-nowrap"
                        >
                          {r[ci] || ""}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
