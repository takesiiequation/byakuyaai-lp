import type { PropertyRow } from "@/app/_lib/properties";
import { sanitizeForPortfolio, parseAndSanitizeFeatures } from "../_lib/sanitizeForPortfolio";
import { priceHeadline, managementFeeNote, floorSummary } from "../_lib/format";
import { Reveal } from "@/app/_components/Motion";

export function PropertyCard({
  row,
  closed,
  delay = 0,
}: {
  row: PropertyRow;
  /** True when this card is being shown via isRecentlyClosed (design §2.1) —
   * price/management-fee/deposit/CTA are all suppressed, "成約済み" badge
   * only. Never true at the same time isPropertyVisible would also be true
   * for the same row (the two functions are mutually exclusive by design). */
  closed?: boolean;
  delay?: number;
}) {
  const name = sanitizeForPortfolio(row.property_name) || "物件";
  const catchCopy1 = sanitizeForPortfolio(row.catch_copy_1);
  const catchCopy2 = sanitizeForPortfolio(row.catch_copy_2);
  const features = parseAndSanitizeFeatures(row.key_features_json);
  const feeNote = managementFeeNote(row);

  return (
    <Reveal delay={delay} className="group">
      <article className="h-full rounded-2xl bg-white ring-1 ring-black/5 shadow-sm overflow-hidden flex flex-col">
        <div className="relative aspect-[4/5] bg-gradient-to-br from-neutral-800 to-neutral-950 flex items-center justify-center overflow-hidden">
          {row.video_url_permanent ? (
            <video
              src={row.video_url_permanent}
              muted
              loop
              playsInline
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs text-white/40 px-4 text-center">
              {name}
            </span>
          )}
          {closed && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
              <span className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-bold text-[var(--brand-ink)]">
                成約済み
              </span>
            </div>
          )}
          {!closed && row.staged && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white">
              ※家具・小物はイメージです
            </span>
          )}
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-2 flex-1">
          <h3 className="text-sm font-bold text-[var(--brand-ink)] leading-snug line-clamp-2">
            {name}
          </h3>

          {catchCopy1 && (
            <p className="text-xs text-[var(--brand-gray)] leading-relaxed line-clamp-2">
              {catchCopy1}
            </p>
          )}
          {catchCopy2 && (
            <p className="text-xs text-[var(--brand-gray-light)] leading-relaxed line-clamp-2">
              {catchCopy2}
            </p>
          )}

          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--brand-gray-light)]">
            {row.nearest_station && <span>{row.nearest_station}</span>}
            {floorSummary(row) && <span>{floorSummary(row)}</span>}
            {row.floor_number && <span>{row.floor_number}</span>}
          </div>

          {features.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {features.slice(0, 4).map((f, i) => (
                <li
                  key={i}
                  className="rounded-full bg-[var(--brand-cream-2)] px-2 py-0.5 text-[10px] text-[var(--brand-ink)]"
                >
                  {f}
                </li>
              ))}
            </ul>
          )}

          {!closed && (
            <div className="mt-auto pt-3 border-t border-[var(--brand-border)]">
              <p className="text-base font-black text-[var(--brand-ink)]">
                {priceHeadline(row)}
              </p>
              {feeNote && (
                <p className="text-[11px] text-[var(--brand-gray-light)]">
                  {feeNote}
                  {row.deposit_key_money_note
                    ? `・${sanitizeForPortfolio(row.deposit_key_money_note)}`
                    : ""}
                </p>
              )}
              {!feeNote && row.deposit_key_money_note && (
                <p className="text-[11px] text-[var(--brand-gray-light)]">
                  {sanitizeForPortfolio(row.deposit_key_money_note)}
                </p>
              )}
            </div>
          )}
        </div>
      </article>
    </Reveal>
  );
}
