import type { PropertyRow } from "@/app/_lib/properties";
import { sanitizeForPortfolio } from "../_lib/sanitizeForPortfolio";
import { priceHeadline } from "../_lib/format";

// RealEstateListing/VideoObject structured data for one property card.
// design §7.4: never emit a VideoObject while video_url_permanent is empty
// — video_url_raw expires in ~3 days, and pointing a crawler at a URL that
// will 404 within days is a net SEO negative, not a neutral omission.
export function PropertyJsonLd({
  row,
  pageUrl,
}: {
  row: PropertyRow;
  pageUrl: string;
}) {
  const name = sanitizeForPortfolio(row.property_name) || "物件";

  const listing: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name,
    url: pageUrl,
    description: sanitizeForPortfolio(row.catch_copy_1) || undefined,
    address: row.address
      ? { "@type": "PostalAddress", addressCountry: "JP", streetAddress: row.address }
      : undefined,
  };

  const priceValue =
    row.deal_type === "売買" ? row.sale_price_yen : row.monthly_rent_yen;
  if (priceValue > 0) {
    listing.offers = {
      "@type": "Offer",
      price: priceValue,
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
      description: priceHeadline(row) || undefined,
    };
  }

  if (row.floor_area_m2 > 0) {
    listing.floorSize = {
      "@type": "QuantitativeValue",
      value: row.floor_area_m2,
      unitCode: "MTK",
    };
  }

  if (row.video_url_permanent) {
    listing.video = {
      "@type": "VideoObject",
      name,
      description: sanitizeForPortfolio(row.catch_copy_1) || name,
      contentUrl: row.video_url_permanent,
      uploadDate: row.published_at || row.created_at || undefined,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(listing) }}
    />
  );
}
