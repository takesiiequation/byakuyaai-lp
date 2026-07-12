'use client';

import { useCallback, useEffect, useState } from 'react';

interface ShareButtonProps {
  url?: string;
  title: string;
}

export default function ShareButton({ url, title }: ShareButtonProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const handleShare = useCallback(async () => {
    const shareUrl = url ?? window.location.href;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage('リンクをコピーしました');
    } catch {
      setToastMessage('コピーに失敗しました');
    }
  }, [url, title]);

  return (
    <div className="relative flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleShare}
        aria-label="共有する"
        style={{ width: 52, height: 52 }}
        className="flex items-center justify-center text-white"
      >
        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 3v12" strokeLinecap="round" />
          <path d="M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="text-xs font-semibold text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
        共有
      </span>
      {toastMessage ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: 'rgba(26,26,26,0.9)' }}
        >
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
