'use client';

import { useMemo, useState } from 'react';
import type { ViewProperty } from '../_lib/viewModel';
import { Reveal, RevealStagger, RevealItem } from '../../_components/Motion';
import FilterBar, { DEFAULT_FILTER_STATE, type FilterState, type SortKey } from './FilterBar';
import PropertyCard from './PropertyCard';

interface GridViewProps {
  properties: ViewProperty[];
  onOpenFeed: (property: ViewProperty) => void;
}

export default function GridView({ properties, onOpenFeed }: GridViewProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [sortKey, setSortKey] = useState<SortKey>('recommended');

  const areas = useMemo(
    () => Array.from(new Set(properties.map((property) => property.area))).sort((a, b) => a.localeCompare(b, 'ja')),
    [properties]
  );

  const layouts = useMemo(
    () => Array.from(new Set(properties.map((property) => property.layout))).sort((a, b) => a.localeCompare(b, 'ja')),
    [properties]
  );

  const allTags = useMemo(
    () =>
      Array.from(new Set(properties.flatMap((property) => property.tags))).sort((a, b) => a.localeCompare(b, 'ja')),
    [properties]
  );

  const filteredProperties = useMemo(() => {
    const filtered = properties.filter((property) => {
      if (filters.area && property.area !== filters.area) return false;
      if (filters.layout && property.layout !== filters.layout) return false;
      if (Number.isFinite(filters.maxRentMan) && property.rentMan > filters.maxRentMan) return false;
      if (filters.walkMax !== null && property.walkMin > filters.walkMax) return false;
      if (filters.noDeposit && property.depositMan !== 0) return false;
      if (filters.noKeyMoney && property.keyMoneyMan !== 0) return false;
      if (filters.buildingAgeMax !== null) {
        if (typeof property.buildingAge !== 'number' || property.buildingAge > filters.buildingAgeMax) return false;
      }
      if (filters.sizeMin !== null && property.sizeSqm < filters.sizeMin) return false;
      if (filters.tags.length > 0 && !filters.tags.every((tag) => property.tags.includes(tag))) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sortKey === 'rentAsc') {
      sorted.sort((a, b) => a.rentMan - b.rentMan);
    } else if (sortKey === 'sizeDesc') {
      sorted.sort((a, b) => b.sizeSqm - a.sizeSqm);
    } else if (sortKey === 'walkAsc') {
      sorted.sort((a, b) => a.walkMin - b.walkMin);
    } else if (sortKey === 'buildingAgeAsc') {
      sorted.sort((a, b) => {
        const ageA = typeof a.buildingAge === 'number' ? a.buildingAge : Number.MAX_SAFE_INTEGER;
        const ageB = typeof b.buildingAge === 'number' ? b.buildingAge : Number.MAX_SAFE_INTEGER;
        return ageA - ageB;
      });
    } else if (sortKey === 'effectiveRentAsc') {
      sorted.sort(
        (a, b) => (a.rentMan * 10000 + a.managementFeeYen) - (b.rentMan * 10000 + b.managementFeeYen)
      );
    } else {
      sorted.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    }
    return sorted;
  }, [properties, filters, sortKey]);

  // properties.length === 0 (genuinely nothing on file yet, e.g. a client
  // mid-onboarding) is a different situation from filteredProperties being
  // emptied by the user's own filter choices — showing a full filter UI
  // with all-empty dropdowns and a "条件を変更して" message would be
  // confusing when there was never anything to filter. Preserves the
  // current /f/[slug] empty-state wording this replaces.
  if (properties.length === 0) {
    return (
      <section className="w-full px-3 py-10 sm:px-6">
        <p className="text-center text-sm text-[var(--text-2)]">
          現在ご案内できる物件はありません。
        </p>
      </section>
    );
  }

  return (
    <section className="w-full px-3 py-4 sm:px-6 sm:py-6">
      <Reveal>
        <FilterBar
          areas={areas}
          layouts={layouts}
          allTags={allTags}
          filters={filters}
          onChange={setFilters}
          sortKey={sortKey}
          onSortChange={setSortKey}
          resultCount={filteredProperties.length}
        />
      </Reveal>

      {filteredProperties.length === 0 ? (
        <p className="mt-10 text-center text-sm text-[var(--text-2)]">
          条件に一致する物件が見つかりませんでした。条件を変更してお試しください。
        </p>
      ) : (
        <RevealStagger className="mt-4 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProperties.map((property) => (
            <RevealItem key={property.id}>
              <PropertyCard property={property} onOpen={() => onOpenFeed(property)} />
            </RevealItem>
          ))}
        </RevealStagger>
      )}
    </section>
  );
}
