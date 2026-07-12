'use client';

import { useEffect, useRef, useState } from 'react';
import type { CustomerData } from '../_data/types';
import type { ViewProperty } from '../_lib/viewModel';
import { PLACEHOLDER_POSTER_DATA_URI } from '../_lib/viewModel';
import { formatRent, formatSize, formatWalk, formatManagementFee, formatDepositKey } from '../_lib/format';
import { useDeviceTier } from '../_lib/useDeviceTier';
import LikeButton from './LikeButton';
import ShareButton from './ShareButton';

interface FeedCardProps {
  property: ViewProperty;
  customer: CustomerData;
  isActive: boolean;
  reducedMotion: boolean;
  onOpenCompliance: () => void;
}

// 9:16ステージの共通ジオメトリ。stage本体とオーバーレイラッパーで同じ式を共有し、
// デスクトップでも動画端とテキスト端が一致するようにする。
const STAGE_WIDTH_STYLE = { width: 'min(100%, calc(100dvh * 9 / 16))' };
const NATIVE_STAGE_RATIO = 9 / 16;

export default function FeedCard({ property, customer, isActive, reducedMotion, onOpenCompliance }: FeedCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fillVideoRef = useRef<HTMLVideoElement | null>(null);
  // メタデータ判明前は「9:16素材」前提でfillを出さず、判明後に非9:16なら追加する
  const [needsFillVideo, setNeedsFillVideo] = useState(false);
  const deviceTier = useDeviceTier();

  // posterUrl is empty until the 物件 DB schema grows a dedicated
  // poster/thumbnail column (see viewModel.ts) — fall back to a neutral
  // placeholder tile at every <img> render site below rather than a broken
  // empty-src image.
  const posterSrc = property.posterUrl || PLACEHOLDER_POSTER_DATA_URI;
  const walkLabel = formatWalk(property.walkMin);

  // saveData/低メモリ/低コア端末ではfill動画レイヤーをblurポスターのみへ自動降格
  const showFillVideo = needsFillVideo && deviceTier !== 'low';

  useEffect(() => {
    const targets = [videoRef.current, showFillVideo ? fillVideoRef.current : null].filter(
      (el): el is HTMLVideoElement => el !== null
    );
    if (targets.length === 0) return;

    if (reducedMotion || !isActive) {
      targets.forEach((el) => el.pause());
      return;
    }

    targets.forEach((el) => {
      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // 自動再生がブラウザにブロックされた場合はポスター表示のままにする
        });
      }
    });
  }, [isActive, reducedMotion, showFillVideo]);

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el || !el.videoWidth || !el.videoHeight) return;
    const ratio = el.videoWidth / el.videoHeight;
    // 9:16素材ならステージにぴったり収まるためfillレイヤーの追加デコードは不要。非9:16と判明した時のみ追加する
    if (Math.abs(ratio - NATIVE_STAGE_RATIO) >= 0.02) {
      setNeedsFillVideo(true);
    }
  };

  const hasVideo = Boolean(property.videoUrl);
  // 動画未設定時のプレースホルダフォールバック(現行実装からの必須要件):
  // v4の <video src={videoUrl}> は videoUrl 空文字でも常時マウントしていたが、
  // 空 src はブラウザが現在のページURLを動画として読み込もうとする無駄な
  // リクエストになりうる(旧実装は video_url_permanent が無ければ<video>自体を
  // 描画しなかった)。hasVideo=false ならポスター表示に倒す。
  const showPoster = reducedMotion || !isActive || !hasVideo;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* card外周アンビエンス: デスクトップの左右余白を環境光として敷く(モバイルではステージが略全幅で不可視) */}
      <img
        src={posterSrc}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[.3]"
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden rounded-none sm:rounded-2xl sm:ring-1 sm:ring-white/10"
          style={{ ...STAGE_WIDTH_STYLE, aspectRatio: '9 / 16' }}
        >
          {/* fill poster: 動画fillの読み込み前・pause中の埋め草として常時敷く(追加コストほぼゼロ) */}
          <img
            src={posterSrc}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-[.45] saturate-125"
          />

          {/* fill video: 前景と同一srcの第2レイヤー。9:16素材/低性能端末ではレンダリングしない */}
          {showFillVideo ? (
            <video
              ref={fillVideoRef}
              src={property.videoUrl}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-[.45] saturate-125"
            />
          ) : null}

          {hasVideo ? (
            <video
              ref={videoRef}
              src={property.videoUrl}
              poster={property.posterUrl || undefined}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : null}

          {showPoster ? (
            <img src={posterSrc} alt={property.title} className="absolute inset-0 h-full w-full object-contain" />
          ) : null}

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.9) 100%)',
            }}
          />

          {/* design doc §7.4: staged=true → 家具・小物はイメージ注記を
              強制表示(v4パッケージには無かった要素、現行実装から移植)。 */}
          {property.staged && (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white">
              ※家具・小物はイメージです
            </span>
          )}
        </div>
      </div>

      <div className="absolute inset-0 mx-auto" style={STAGE_WIDTH_STYLE}>
        <div
          className="absolute bottom-6 right-4 z-10 flex flex-col items-center gap-5"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <LikeButton propertyId={property.id} size="md" />
          <ShareButton title={`${property.title} | ${customer.company}`} />
        </div>

        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 px-5 pb-6 pr-20 text-white"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          <span
            className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: 'var(--brand-orange)' }}
          >
            {customer.tradeType}
          </span>

          <h2 className="text-lg font-bold leading-snug">{property.title}</h2>

          <p className="text-sm text-white/90">
            {property.stationName ? `${property.stationName} ` : ''}
            {walkLabel}
            {walkLabel && ' ・ '}
            {property.layout} ・ {formatSize(property.sizeSqm)}
            {property.floor ? ` ・ ${property.floor}` : ''}
          </p>

          <p className="text-sm text-white/80">{property.address}</p>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-semibold">
            <span>{formatRent(property.rentMan)}</span>
            <span>{formatManagementFee(property.managementFeeYen)}</span>
            {/* depositKeyNote (free text, sanitized) takes priority over the
                numeric formatter — see viewModel.ts ViewProperty doc: the
                current schema has no structured deposit/key-money split, so
                depositMan/keyMoneyMan are always 0 and formatDepositKey(0,0)
                would falsely claim "no deposit/key money". */}
            <span>{property.depositKeyNote || formatDepositKey(property.depositMan, property.keyMoneyMan)}</span>
          </div>

          {property.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {property.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 text-xs"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a
              href={customer.lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-5 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: '#06c755' }}
            >
              LINEで相談する
            </a>
            {/* No phone-number column exists anywhere in the current schema
                (see viewModel.ts toCustomerData) — hide the tel: link
                entirely rather than render a broken `tel:` href with no
                number, unlike v4's original unconditional rendering. */}
            {customer.tel && (
              <a href={`tel:${customer.tel}`} className="text-sm font-medium text-white/85 underline underline-offset-2">
                電話で相談 {customer.tel}
              </a>
            )}
            <button
              type="button"
              onClick={onOpenCompliance}
              className="rounded-full px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
            >
              会社概要
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
