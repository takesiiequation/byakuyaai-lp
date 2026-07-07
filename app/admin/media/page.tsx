"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MEDIA_MAX_FILE_SIZE_BYTES,
  MEDIA_MAX_FILE_SIZE_LABEL,
} from "@/app/_lib/types";

interface MediaFile {
  id: string;
  name: string;
  size: number;
  createdTime: string;
  mimeType: string;
}

type Tab = "bgm" | "se";

function formatSize(bytes: number): string {
  if (!bytes) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function previewUrl(id: string): string {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export default function MediaPage() {
  const [tab, setTab] = useState<Tab>("bgm");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async (t: Tab) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/media?type=${t}`);
      const data = await res.json();
      if (data.ok) {
        setFiles(data.data);
      } else {
        setError(data.error || "取得に失敗しました");
        setFiles([]);
      }
    } catch (e) {
      setError(String(e));
      setFiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFiles(tab);
  }, [tab, fetchFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MEDIA_MAX_FILE_SIZE_BYTES) {
      setUploadMsg({
        text: `ファイルサイズが大きすぎます(上限${MEDIA_MAX_FILE_SIZE_LABEL})`,
        ok: false,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/media?type=${tab}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        setUploadMsg({ text: `${file.name} をアップロードしました`, ok: true });
        fetchFiles(tab);
      } else {
        setUploadMsg({ text: data.error || "アップロードに失敗しました", ok: false });
      }
    } catch (e) {
      setUploadMsg({ text: String(e), ok: false });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/media/${confirmDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        setFiles((f) => f.filter((x) => x.id !== confirmDelete.id));
        setConfirmDelete(null);
      } else {
        setUploadMsg({ text: data.error || "削除に失敗しました", ok: false });
      }
    } catch (e) {
      setUploadMsg({ text: String(e), ok: false });
    }
    setDeleting(false);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)]">
          BGM / SE 管理
        </h1>
      </div>

      <div className="bg-blue-50 border border-blue-100 text-blue-700 text-sm px-4 py-2.5 rounded-xl">
        追加したBGMは次回生成から自動で抽選対象になります。
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("bgm")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "bgm"
              ? "bg-[var(--brand-orange)] text-white"
              : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          BGM
        </button>
        <button
          onClick={() => setTab("se")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            tab === "se"
              ? "bg-[var(--brand-orange)] text-white"
              : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          SE
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            {tab === "bgm" ? "BGM一覧" : "SE一覧"}
          </h2>
          <label className="cursor-pointer bg-gradient-to-r from-[var(--brand-orange)] to-[var(--brand-orange-dark)] text-white font-semibold rounded-xl px-4 py-2 text-xs hover:shadow-lg transition-all active:scale-[0.98]">
            {uploading ? "アップロード中..." : "+ アップロード"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {uploadMsg && (
          <div
            className={`mx-4 sm:mx-6 mt-3 text-sm px-3 py-2 rounded-lg ${
              uploadMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {uploadMsg.text}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">読み込み中...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 bg-red-50 m-4 sm:m-6 rounded-xl">
            {error}
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {tab === "bgm" ? "BGM" : "SE"}がまだありません
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {files.map((f) => (
              <div
                key={f.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[var(--brand-ink)] truncate">
                    {f.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {formatSize(f.size)} · {formatDate(f.createdTime)}
                  </div>
                </div>
                <audio controls className="h-9 max-w-full sm:w-64">
                  <source src={previewUrl(f.id)} />
                </audio>
                <button
                  onClick={() => setConfirmDelete(f)}
                  className="text-xs font-medium text-red-500 hover:text-red-700 shrink-0 px-2 py-1"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-[var(--brand-ink)] mb-2">削除しますか?</h3>
            <p className="text-sm text-gray-500 mb-5 break-all">
              「{confirmDelete.name}」を削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="text-gray-500 font-medium rounded-xl px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
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
