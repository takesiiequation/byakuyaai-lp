import Link from "next/link";
import type { CustomerData } from "../_data/types";
import type { ViewProperty } from "../_lib/viewModel";
import { jsonLdEligible } from "../_lib/viewModel";
import { PropertyJsonLd } from "./PropertyJsonLd";
import { PropertyExplorer } from "./PropertyExplorer";
import ComplianceFooter from "./ComplianceFooter";
import ThemeScript from "./ThemeScript";
import ThemeProvider from "./ThemeProvider";
import AdaptiveHeader from "./AdaptiveHeader";
import HeroSection from "./HeroSection";

/**
 * Shared presentational shell for both /f/[slug] (live Sheets data) and
 * /f/demo (static 白金台 data) — both routes resolve their own data source,
 * apply the same visibility rules, and hand the already-filtered result to
 * this component. Keeps the two entry points from drifting in markup (same
 * rationale as the pre-v4 version of this file). Internals are the v4 UI
 * package's own composition (AdaptiveHeader/HeroSection/PropertyExplorer/
 * ComplianceFooter/ThemeProvider), lifted near-verbatim from the package's
 * own app/f/[slug]/page.tsx.
 */
export function PortfolioView({
  customer,
  properties,
  pageUrl,
  demoNotice,
}: {
  customer: CustomerData;
  /** Already filtered to isPropertyVisible rows by the caller — this
   * component does no gating of its own (design §0/§2.1's "唯一の実体" is
   * app/_lib/properties.ts, not this file). */
  properties: ViewProperty[];
  pageUrl: string;
  /** Set only by /f/demo — renders a fixed, high-contrast top banner so this
   * page can never be mistaken for a real active listing, and pushes
   * AdaptiveHeader down so the two don't overlap. */
  demoNotice?: string;
}) {
  // jsonld.ts's buildGraph() throws per-row if uploadDate is empty — only
  // hand it rows that have one (see viewModel.ts jsonLdEligible). The full
  // `properties` list (regardless of uploadDate) still goes to
  // HeroSection/PropertyExplorer for display.
  const jsonLdActive = jsonLdEligible(properties);
  const headerOffset = demoNotice ? { top: "2.25rem" } : undefined;

  return (
    <>
      <ThemeScript />
      <ThemeProvider>
        <div className="flex min-h-screen flex-col bg-[var(--surface)] text-[var(--text-1)]">
          {demoNotice && (
            <div
              role="status"
              className="fixed inset-x-0 top-0 z-50 bg-[var(--brand-orange-dark)] px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm"
            >
              {demoNotice}
            </div>
          )}

          {/* is_demo rows never emit RealEstateListing/VideoObject structured
              data (jsonLdEligible already excludes them via missing
              uploadDate for the shirokanedai fixture — see /f/demo/page.tsx
              — but this call itself is also skipped entirely for demoNotice
              pages as a second, explicit safety net). */}
          {!demoNotice && (
            <PropertyJsonLd customer={customer} active={jsonLdActive} pageUrl={pageUrl} />
          )}

          <div id="ah-sentinel-top" aria-hidden className="h-px w-full" />

          <AdaptiveHeader customer={customer} style={headerOffset} />

          <main className="flex-1">
            <HeroSection customer={customer} properties={properties} />

            <div
              id="properties"
              className="relative z-10 -mt-10 scroll-mt-20 rounded-t-[2.5rem] bg-[var(--surface)] shadow-[0_-24px_60px_rgba(0,0,0,.25)]"
            >
              <div id="ah-sentinel-boundary" aria-hidden className="h-px w-full" />

              <PropertyExplorer properties={properties} customer={customer} />
            </div>
          </main>

          <ComplianceFooter
            company={customer.company}
            tradeType={customer.tradeType}
            licenseNo={customer.licenseNo}
            address={customer.address}
          />

          <footer className="border-t border-[var(--border-1)] bg-[var(--surface-2)] py-6 text-center text-xs text-[var(--text-3)]">
            <p>Powered by ByakuyaAI</p>
            <p className="mt-2 flex items-center justify-center gap-4">
              <Link href="/tokushoho" className="underline transition hover:text-[var(--accent)]">
                特定商取引法に基づく表記
              </Link>
              <Link href="/privacy" className="underline transition hover:text-[var(--accent)]">
                プライバシーポリシー
              </Link>
            </p>
          </footer>
        </div>
      </ThemeProvider>
    </>
  );
}
