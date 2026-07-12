import type { PropertyRow } from "@/app/_lib/properties";
import { PropertyCard } from "./PropertyCard";
import { PropertyJsonLd } from "./PropertyJsonLd";
import { ComplianceFooter } from "./ComplianceFooter";
import { Hero } from "./Hero";

export interface DisplayProperty {
  row: PropertyRow;
  /** true = rendered via isRecentlyClosed (成約済みバッジ, no price/CTA).
   * false = rendered via isPropertyVisible (normal active listing). */
  closed: boolean;
}

/**
 * Shared presentational shell for both /f/[slug] (live Sheets data) and
 * /f/demo (static 白金台 data) — both routes resolve their own data source,
 * apply the same visibility rules, and hand the already-filtered result to
 * this component. Keeps the two entry points from drifting in markup.
 */
export function PortfolioView({
  clientName,
  tagline,
  pageBaseUrl,
  licenseNumber,
  transactionType,
  properties,
  demoNotice,
}: {
  clientName: string;
  tagline?: string;
  pageBaseUrl: string;
  licenseNumber?: string;
  transactionType?: string;
  properties: DisplayProperty[];
  /** Set only by /f/demo — replaces the license/transaction-type compliance
   * line with an explicit "this is a sample, not a real listing" notice, so
   * this page can never be mistaken for an actual active property ad. */
  demoNotice?: string;
}) {
  return (
    <main className="min-h-screen bg-neutral-950">
      {demoNotice && (
        <div className="bg-[var(--brand-orange-dark)] px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
          {demoNotice}
        </div>
      )}
      <Hero clientName={clientName} tagline={tagline} />

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {properties.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-10 text-center text-sm text-white/50">
            現在ご案内できる物件はありません。
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map(({ row, closed }, i) => (
              <div key={row.property_key || i}>
                {/* is_demo rows (白金台デモ) are sample content, not a real
                    bookable listing — never emit RealEstateListing/VideoObject
                    structured data for them (would misrepresent a demo as
                    real inventory to crawlers/AEO). */}
                {!closed && !row.is_demo && (
                  <PropertyJsonLd
                    row={row}
                    pageUrl={`${pageBaseUrl}#${encodeURIComponent(row.property_key)}`}
                  />
                )}
                <PropertyCard row={row} closed={closed} delay={(i % 6) * 0.05} />
              </div>
            ))}
          </div>
        )}
      </section>

      <ComplianceFooter licenseNumber={licenseNumber} transactionType={transactionType} />
    </main>
  );
}
