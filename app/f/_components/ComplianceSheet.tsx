'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CustomerData } from '../_data/types';

interface ComplianceSheetProps {
  open: boolean;
  onClose: () => void;
  customer: CustomerData;
}

function formatAddress(customer: CustomerData): string | null {
  const address = customer.address;

  if (!address) {
    return null;
  }

  const postal = address.postalCode ? `〒${address.postalCode} ` : '';
  const street = address.streetAddress ?? '';

  return `${postal}${address.prefecture}${address.city}${street}`;
}

export function ComplianceSheet({ open, onClose, customer }: ComplianceSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeButtonRef.current?.focus();
  }, [open]);

  const address = formatAddress(customer);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="compliance-sheet-title"
            className="relative z-10 max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--surface-raised)] p-6 shadow-2xl sm:rounded-2xl"
            style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="compliance-sheet-title" className="text-lg font-bold text-[var(--text-1)]">
                会社概要
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-2)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text-1)]"
              >
                ×
              </button>
            </div>

            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[var(--text-3)]">商号</dt>
                <dd className="mt-1 font-semibold text-[var(--text-1)]">{customer.company}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-3)]">取引形態</dt>
                <dd className="mt-1 font-semibold text-[var(--text-1)]">{customer.tradeType}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-3)]">免許番号</dt>
                <dd className="mt-1 font-semibold text-[var(--text-1)]">{customer.licenseNo}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-3)]">電話番号</dt>
                <dd className="mt-1 font-semibold text-[var(--text-1)]">
                  <a href={`tel:${customer.tel}`} className="underline hover:text-[var(--accent)]">
                    {customer.tel}
                  </a>
                </dd>
              </div>
              {address ? (
                <div>
                  <dt className="text-[var(--text-3)]">所在地</dt>
                  <dd className="mt-1 font-semibold text-[var(--text-1)]">{address}</dd>
                </div>
              ) : null}
            </dl>

            {customer.companyDescription ? (
              <p className="mt-5 border-t border-[var(--border-1)] pt-4 text-xs leading-relaxed text-[var(--text-2)]">
                {customer.companyDescription}
              </p>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
