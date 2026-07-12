"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BANNED_WORD_TYPES,
  BANNED_WORD_TYPE_LABELS,
  type BannedWord,
  type BannedWordType,
} from "@/app/_lib/types";

type FormState = {
  word: string;
  type: BannedWordType;
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  word: "",
  type: "valueless",
  enabled: true,
};

export default function BannedWordsClient() {
  const [words, setWords] = useState<BannedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BannedWord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const fetchWords = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const res = await fetch("/api/banned-words");
      const data = await res.json();
      if (data.ok) {
        setWords(data.data);
      } else {
        setListError(data.error || "取得に失敗しました");
      }
    } catch (e) {
      setListError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  function openNewForm() {
    setEditingWord(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(w: BannedWord) {
    setEditingWord(w.word);
    setForm({
      word: w.word,
      type: (w.type === "shape" ? "shape" : "valueless") as BannedWordType,
      enabled: w.enabled,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  async function submitForm() {
    if (!form.word.trim()) {
      setFormError("wordは必須です");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/banned-words", {
        method: editingWord ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: editingWord ?? form.word.trim(),
          type: form.type,
          enabled: form.enabled,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFormOpen(false);
        fetchWords();
      } else {
        setFormError(data.error || "保存に失敗しました");
      }
    } catch (e) {
      setFormError(String(e));
    }
    setSaving(false);
  }

  async function toggleEnabled(w: BannedWord) {
    setWords((ws) =>
      ws.map((x) => (x.word === w.word ? { ...x, enabled: !x.enabled } : x))
    );
    try {
      const res = await fetch("/api/banned-words", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w.word, enabled: !w.enabled }),
      });
      const data = await res.json();
      if (!data.ok) {
        setWords((ws) =>
          ws.map((x) => (x.word === w.word ? { ...x, enabled: w.enabled } : x))
        );
        setListError(data.error || "更新に失敗しました");
      }
    } catch (e) {
      setWords((ws) =>
        ws.map((x) => (x.word === w.word ? { ...x, enabled: w.enabled } : x))
      );
      setListError(String(e));
    }
  }

  function openDelete(w: BannedWord) {
    setDeleteTarget(w);
    setDeleteMsg("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteMsg("");
    try {
      const res = await fetch(
        `/api/banned-words?word=${encodeURIComponent(deleteTarget.word)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.ok) {
        setWords((ws) => ws.filter((x) => x.word !== deleteTarget.word));
        setDeleteTarget(null);
      } else {
        setDeleteMsg(data.error || "削除に失敗しました");
      }
    } catch (e) {
      setDeleteMsg(String(e));
    }
    setDeleting(false);
  }

  const shapeWords = words.filter((w) => w.type === "shape");
  const valuelessWords = words.filter((w) => w.type === "valueless");

  function WordRow({ w }: { w: BannedWord }) {
    return (
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-[var(--brand-ink)]">
              {w.word}
            </span>
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
              {BANNED_WORD_TYPE_LABELS[w.type === "shape" ? "shape" : "valueless"]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleEnabled(w)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
              w.enabled
                ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                : "bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200"
            }`}
          >
            {w.enabled ? "有効" : "無効"}
          </button>
          <button
            onClick={() => openEditForm(w)}
            className="text-xs font-medium text-gray-600 hover:text-[var(--brand-orange)] px-2 py-1.5 transition-colors"
          >
            編集
          </button>
          <button
            onClick={() => openDelete(w)}
            className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1.5 transition-colors"
          >
            削除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-16">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          禁止語管理
        </h1>
        <button
          onClick={openNewForm}
          className="shrink-0 bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-light)] text-white font-semibold rounded-xl px-4 py-2 text-xs sm:text-sm hover:shadow-lg transition-all active:scale-[0.98]"
        >
          + 禁止語を追加
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm px-4 py-2.5 rounded-xl">
        マイソクOCR由来のテキストから除去する単語の一覧です。「形状語」はマイソクに実際に記載がある場合のみ通過、「無価値語」は無条件で除去されます。n8n側は実行冒頭でこのシートを読み取り、読み取りに失敗した場合は既存のハードコードされたリストへfail-openフォールバックします。
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            登録済み禁止語
          </h2>
        </div>

        {listError && (
          <div className="m-4 sm:m-6 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {listError}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : words.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            禁止語がまだ登録されていません
          </div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-2 bg-gray-50/60 border-b border-gray-50">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {BANNED_WORD_TYPE_LABELS.shape}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {shapeWords.length === 0 ? (
                <div className="p-4 text-center text-gray-300 text-xs">なし</div>
              ) : (
                shapeWords.map((w) => <WordRow key={w.word} w={w} />)
              )}
            </div>
            <div className="px-4 sm:px-6 py-2 bg-gray-50/60 border-b border-t border-gray-50">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {BANNED_WORD_TYPE_LABELS.valueless}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {valuelessWords.length === 0 ? (
                <div className="p-4 text-center text-gray-300 text-xs">なし</div>
              ) : (
                valuelessWords.map((w) => <WordRow key={w.word} w={w} />)
              )}
            </div>
          </>
        )}
      </div>

      {/* --- 追加/編集フォーム --- */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full my-auto">
            <h3 className="font-bold text-[var(--brand-ink)] mb-4">
              {editingWord ? `禁止語を編集: ${editingWord}` : "禁止語を追加"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  word
                </label>
                <input
                  type="text"
                  value={form.word}
                  disabled={!!editingWord}
                  onChange={(e) => setForm((f) => ({ ...f, word: e.target.value }))}
                  placeholder="例: 大理石"
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as BannedWordType }))
                  }
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)] focus:border-transparent focus:bg-white transition-colors appearance-none"
                >
                  {BANNED_WORD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BANNED_WORD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="w-4 h-4 accent-[var(--brand-orange)]"
                />
                有効(enabled)
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
            <h3 className="font-bold text-[var(--brand-ink)] mb-2">
              削除しますか?
            </h3>
            <p className="text-sm text-gray-500 mb-5 break-words">
              「{deleteTarget.word}」を削除します。この操作は取り消せません。
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
          </div>
        </div>
      )}
    </div>
  );
}
