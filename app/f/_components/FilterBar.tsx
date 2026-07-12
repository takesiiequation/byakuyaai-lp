'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { animate } from 'framer-motion';
import { useReducedMotion } from '../_lib/useReducedMotion';

export type SortKey = 'recommended' | 'rentAsc' | 'sizeDesc' | 'walkAsc' | 'buildingAgeAsc' | 'effectiveRentAsc';

export interface FilterState {
  area: string;
  layout: string;
  maxRentMan: number;
  walkMax: number | null;
  noDeposit: boolean;
  noKeyMoney: boolean;
  buildingAgeMax: number | null;
  sizeMin: number | null;
  tags: string[];
}

export const DEFAULT_FILTER_STATE: FilterState = {
  area: '',
  layout: '',
  maxRentMan: Infinity,
  walkMax: null,
  noDeposit: false,
  noKeyMoney: false,
  buildingAgeMax: null,
  sizeMin: null,
  tags: [],
};

const RENT_CAPS: { label: string; value: number }[] = [
  { label: '賃料こだわらない', value: Infinity },
  { label: '6万円以下', value: 6 },
  { label: '8万円以下', value: 8 },
  { label: '10万円以下', value: 10 },
  { label: '15万円以下', value: 15 },
  { label: '20万円以下', value: 20 },
];

const WALK_STEPS: { label: string; value: number | null }[] = [
  { label: 'こだわらない', value: null },
  { label: '徒歩5分以内', value: 5 },
  { label: '徒歩10分以内', value: 10 },
  { label: '徒歩15分以内', value: 15 },
];

const BUILDING_AGE_STEPS: { label: string; value: number | null }[] = [
  { label: '指定なし', value: null },
  { label: '5年以内', value: 5 },
  { label: '10年以内', value: 10 },
  { label: '20年以内', value: 20 },
];

const SIZE_MIN_STEPS: { label: string; value: number | null }[] = [
  { label: '指定なし', value: null },
  { label: '20㎡〜', value: 20 },
  { label: '30㎡〜', value: 30 },
  { label: '40㎡〜', value: 40 },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'おすすめ順', value: 'recommended' },
  { label: '賃料が安い順', value: 'rentAsc' },
  { label: '広さが広い順', value: 'sizeDesc' },
  { label: '徒歩が近い順', value: 'walkAsc' },
  { label: '築年数が新しい順', value: 'buildingAgeAsc' },
  { label: '実質賃料が安い順', value: 'effectiveRentAsc' },
];

export function countActiveAdvancedFilters(filters: FilterState): number {
  let count = 0;
  if (filters.noDeposit) count += 1;
  if (filters.noKeyMoney) count += 1;
  if (filters.buildingAgeMax !== null) count += 1;
  if (filters.sizeMin !== null) count += 1;
  if (filters.walkMax !== null) count += 1;
  if (filters.tags.length > 0) count += 1;
  return count;
}

interface FilterBarProps {
  areas: string[];
  layouts: string[];
  allTags: string[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
  resultCount: number;
}

const LABEL_CLASS = 'flex flex-1 min-w-[calc(50%-0.5rem)] flex-col gap-1 text-xs text-[var(--text-2)] sm:min-w-[var(--control-min-w)]';
const SELECT_CLASS = 'f-control w-full sm:text-sm';

function ResultCount({ count }: { count: number }) {
  const reducedMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevCountRef = useRef(count);

  useLayoutEffect(() => {
    const node = spanRef.current;
    if (!node) return;

    if (reducedMotion) {
      node.textContent = String(count);
      prevCountRef.current = count;
      return;
    }

    const from = prevCountRef.current;
    const controls = animate(from, count, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate: (value) => {
        node.textContent = String(Math.round(value));
      },
    });
    prevCountRef.current = count;

    return () => controls.stop();
  }, [count, reducedMotion]);

  return (
    <span ref={spanRef} className="tabular-nums">
      {count}
    </span>
  );
}

export default function FilterBar({
  areas,
  layouts,
  allTags,
  filters,
  onChange,
  sortKey,
  onSortChange,
  resultCount,
}: FilterBarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleAreaChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, area: event.target.value });
  };

  const handleLayoutChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, layout: event.target.value });
  };

  const handleRentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const parsed = Number(event.target.value);
    onChange({ ...filters, maxRentMan: Number.isNaN(parsed) ? Infinity : parsed });
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSortChange(event.target.value as SortKey);
  };

  const handleWalkChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value;
    onChange({ ...filters, walkMax: raw === '' ? null : Number(raw) });
  };

  const handleBuildingAgeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value;
    onChange({ ...filters, buildingAgeMax: raw === '' ? null : Number(raw) });
  };

  const handleSizeMinChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = event.target.value;
    onChange({ ...filters, sizeMin: raw === '' ? null : Number(raw) });
  };

  const handleNoDepositToggle = () => {
    onChange({ ...filters, noDeposit: !filters.noDeposit });
  };

  const handleNoKeyMoneyToggle = () => {
    onChange({ ...filters, noKeyMoney: !filters.noKeyMoney });
  };

  const handleTagToggle = (tag: string) => {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags: next });
  };

  const handleReset = () => {
    onChange(DEFAULT_FILTER_STATE);
    onSortChange('recommended');
  };

  const activeAdvancedCount = countActiveAdvancedFilters(filters);

  return (
    <div className="w-full rounded-2xl border border-[var(--border-1)] bg-[var(--surface-2)]/90 p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-2 sm:gap-3">
        <label className={LABEL_CLASS}>
          エリア
          <span className="f-control-wrap">
            <select value={filters.area} onChange={handleAreaChange} className={SELECT_CLASS}>
              <option value="">すべて</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={LABEL_CLASS}>
          間取り
          <span className="f-control-wrap">
            <select value={filters.layout} onChange={handleLayoutChange} className={SELECT_CLASS}>
              <option value="">すべて</option>
              {layouts.map((layout) => (
                <option key={layout} value={layout}>
                  {layout}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={LABEL_CLASS}>
          賃料帯
          <span className="f-control-wrap">
            <select
              value={Number.isFinite(filters.maxRentMan) ? String(filters.maxRentMan) : 'Infinity'}
              onChange={handleRentChange}
              className={SELECT_CLASS}
            >
              {RENT_CAPS.map((cap) => (
                <option key={cap.label} value={Number.isFinite(cap.value) ? String(cap.value) : 'Infinity'}>
                  {cap.label}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className={LABEL_CLASS}>
          並び替え
          <span className="f-control-wrap">
            <select value={sortKey} onChange={handleSortChange} className={SELECT_CLASS}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={advancedOpen}
          data-active={activeAdvancedCount > 0 ? 'true' : undefined}
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="f-chip"
        >
          詳細条件{activeAdvancedCount > 0 ? `(${activeAdvancedCount})` : ''}
        </button>

        <button type="button" onClick={handleReset} className="f-chip ml-auto">
          条件をリセット
        </button>
      </div>

      {advancedOpen ? (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--border-1)] bg-[var(--surface-3)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={filters.noDeposit}
              onClick={handleNoDepositToggle}
              className="f-chip"
            >
              敷金なし
            </button>
            <button
              type="button"
              aria-pressed={filters.noKeyMoney}
              onClick={handleNoKeyMoneyToggle}
              className="f-chip"
            >
              礼金なし
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className={LABEL_CLASS}>
              築年数
              <span className="f-control-wrap">
                <select
                  value={filters.buildingAgeMax === null ? '' : String(filters.buildingAgeMax)}
                  onChange={handleBuildingAgeChange}
                  className={SELECT_CLASS}
                >
                  {BUILDING_AGE_STEPS.map((step) => (
                    <option key={step.label} value={step.value === null ? '' : String(step.value)}>
                      {step.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className={LABEL_CLASS}>
              広さ下限
              <span className="f-control-wrap">
                <select
                  value={filters.sizeMin === null ? '' : String(filters.sizeMin)}
                  onChange={handleSizeMinChange}
                  className={SELECT_CLASS}
                >
                  {SIZE_MIN_STEPS.map((step) => (
                    <option key={step.label} value={step.value === null ? '' : String(step.value)}>
                      {step.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <label className={LABEL_CLASS}>
              徒歩
              <span className="f-control-wrap">
                <select
                  value={filters.walkMax === null ? '' : String(filters.walkMax)}
                  onChange={handleWalkChange}
                  className={SELECT_CLASS}
                >
                  {WALK_STEPS.map((step) => (
                    <option key={step.label} value={step.value === null ? '' : String(step.value)}>
                      {step.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          </div>

          {allTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--text-3)]">タグ</span>
              {allTags.map((tag) => {
                const active = filters.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleTagToggle(tag)}
                    className="f-chip"
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-xs text-[var(--text-3)]">
        <ResultCount count={resultCount} />件の物件
      </p>
    </div>
  );
}
