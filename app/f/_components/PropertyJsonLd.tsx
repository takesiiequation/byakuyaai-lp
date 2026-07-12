import { buildGraph } from '../_lib/jsonld';
import type { ActivePropertyVideo, CustomerData } from '../_data/types';

interface PropertyJsonLdProps {
  customer: CustomerData;
  active: ActivePropertyVideo[];
  pageUrl: string;
}

export function PropertyJsonLd({ customer, active, pageUrl }: PropertyJsonLdProps) {
  const graph = buildGraph(customer, active, pageUrl);
  const json = JSON.stringify(graph).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
