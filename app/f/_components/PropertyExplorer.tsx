'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CustomerData } from '../_data/types';
import type { ViewProperty } from '../_lib/viewModel';
import { useReducedMotion } from '../_lib/useReducedMotion';
import GridView from './GridView';
import FeedView from './FeedView';
import { ComplianceSheet } from './ComplianceSheet';

type ExplorerView = 'grid' | 'feed';

interface PropertyExplorerProps {
  properties: ViewProperty[];
  customer: CustomerData;
}

export function PropertyExplorer({ properties, customer }: PropertyExplorerProps) {
  const [view, setView] = useState<ExplorerView>('grid');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);
  const reducedMotion = useReducedMotion();

  const isFeedView = view === 'feed';

  const handleOpenFeed = (property: ViewProperty) => {
    const index = properties.findIndex((candidate) => candidate.id === property.id);
    setSelectedIndex(index >= 0 ? index : 0);
    setView('feed');
  };

  const handleBack = () => {
    setView('grid');
  };

  return (
    <div className="relative">
      <div
        aria-hidden={isFeedView || undefined}
        inert={isFeedView || undefined}
        className={isFeedView ? 'invisible' : undefined}
      >
        <GridView properties={properties} onOpenFeed={handleOpenFeed} />
      </div>

      {isFeedView ? (
        <motion.div
          initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-black"
        >
          <FeedView
            properties={properties}
            customer={customer}
            initialIndex={selectedIndex}
            onBack={handleBack}
            onOpenCompliance={() => setIsComplianceOpen(true)}
            keyboardDisabled={isComplianceOpen}
          />
        </motion.div>
      ) : null}

      {view === 'grid' ? (
        <button
          type="button"
          onClick={() => setIsComplianceOpen(true)}
          className="fixed left-4 z-40 flex items-center gap-1.5 rounded-full border border-[var(--border-1)] bg-[var(--surface-header)] px-4 py-2 text-xs font-semibold text-[var(--text-1)] shadow-lg backdrop-blur transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:text-sm"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <span aria-hidden="true">🏢</span>
          会社概要
        </button>
      ) : null}

      <ComplianceSheet
        open={isComplianceOpen}
        onClose={() => setIsComplianceOpen(false)}
        customer={customer}
      />
    </div>
  );
}
