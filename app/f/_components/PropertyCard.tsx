'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TiltCard } from '../../_components/Motion';
import { useReducedMotion } from '../_lib/useReducedMotion';
import LikeButton from './LikeButton';
import { formatRent, formatSize, formatWalk, formatManagementFee, formatDepositKey } from '../_lib/format';
import { PLACEHOLDER_POSTER_DATA_URI, type ViewProperty } from '../_lib/viewModel';

interface PropertyCardProps {
  property: ViewProperty;
  onOpen: () => void;
}

export default function PropertyCard({ property, onOpen }: PropertyCardProps) {
  const {
    id,
    title,
    area,
    stationName,
    layout,
    sizeSqm,
    walkMin,
    rentMan,
    managementFeeYen,
    depositMan,
    keyMoneyMan,
    depositKeyNote,
    staged,
    floor,
    buildingAge,
    posterUrl,
    tags,
    videoDurationSec,
    aspect,
  } = property;

  const thumbAspectClass = aspect === '1:1' ? 'aspect-square' : aspect === '16:9' ? 'aspect-video' : 'aspect-[9/16]';
  const walkLabel = formatWalk(walkMin);

  const reducedMotion = useReducedMotion();
  const [sweepKey, setSweepKey] = useState(0);

  // 表示時に一度だけハイライトスイープを再生する
  useEffect(() => {
    if (!reducedMotion) {
      setSweepKey((current) => current + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSweep = () => {
    if (!reducedMotion) {
      setSweepKey((current) => current + 1);
    }
  };

  return (
    <TiltCard className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)] shadow-[var(--shadow-card)]">
      <div className={`relative ${thumbAspectClass} w-full overflow-hidden bg-[var(--surface-3)]`}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${title}の動画を見る`}
          className="absolute inset-0 h-full w-full cursor-pointer"
        >
          {/* posterUrl is empty until the 物件 DB schema grows a dedicated
              poster/thumbnail column (see viewModel.ts) — fall back to a
              neutral placeholder tile rather than a broken <img>. */}
          <img src={posterUrl || PLACEHOLDER_POSTER_DATA_URI} alt="" loading="lazy" className="h-full w-full object-cover" />
          {walkLabel && (
            <span className="absolute left-2 top-2 rounded-full bg-[var(--overlay)] px-2 py-1 text-[0.65rem] font-bold text-white">
              {walkLabel}
            </span>
          )}
          {typeof videoDurationSec === 'number' && (
            <span className="absolute bottom-2 right-2 rounded-full bg-[var(--overlay)] px-2 py-1 text-[0.65rem] text-white">
              {Math.floor(videoDurationSec / 60)}:{String(videoDurationSec % 60).padStart(2, '0')}
            </span>
          )}
          {/* design doc §7.4: staged=true → 家具・小物はイメージ注記を
              強制表示(v4パッケージには無かった要素、現行実装から移植)。 */}
          {staged && (
            <span className="absolute bottom-2 left-2 rounded-full bg-[var(--overlay)] px-2.5 py-1 text-[10px] text-white">
              ※家具・小物はイメージです
            </span>
          )}
        </button>

        <div className="absolute right-2 top-2 z-10">
          <LikeButton propertyId={id} size="sm" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-[var(--text-1)]">{title}</h3>

        <p className="text-xs text-[var(--text-2)]">
          {area}
          {stationName ? ` ・ ${stationName}${walkLabel ? ` ${walkLabel}` : ''}` : walkLabel ? ` ・ ${walkLabel}` : ''}
        </p>

        <div
          className="relative overflow-hidden rounded-lg bg-[var(--surface-3)] p-2"
          onMouseEnter={triggerSweep}
        >
          {!reducedMotion && sweepKey > 0 ? (
            <motion.span
              key={sweepKey}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(75deg, transparent 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.35) 55%, transparent 100%)',
              }}
              initial={{ x: '-120%' }}
              animate={{ x: '120%' }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            />
          ) : null}
          <p className="relative text-sm font-bold text-[var(--text-1)]">
            {formatRent(rentMan)} / {formatManagementFee(managementFeeYen)} /{' '}
            {/* depositKeyNote (free text, sanitized) takes priority over the
                numeric formatter — see viewModel.ts ViewProperty doc: the
                current schema has no structured deposit/key-money split, so
                depositMan/keyMoneyMan are always 0 and formatDepositKey(0,0)
                would falsely claim "no deposit/key money". */}
            {depositKeyNote || formatDepositKey(depositMan, keyMoneyMan)}
          </p>
        </div>

        <p className="text-xs text-[var(--text-2)]">
          {layout} ・ {formatSize(sizeSqm)}
          {floor ? ` ・ ${floor}` : ''}
          {typeof buildingAge === 'number' ? ` ・ 築${buildingAge}年` : ''}
        </p>

        {tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border-1)] px-2 py-0.5 text-[0.65rem] text-[var(--text-2)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </TiltCard>
  );
}
