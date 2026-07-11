// Shared shape for /admin/manual. This repo is a *public* GitHub repo, so
// manual step data files under app/_data/manuals/ must never contain a
// literal secret or a real n8n/service endpoint URL. Where a step needs one
// (service account email, webhook URL), the data file references a
// `valueKey` instead — the actual value is resolved server-side per request
// by app/_lib/manualValues.ts (reads env) and injected only at render time
// in app/admin/manual/[slug]/page.tsx. Adding a new manual is just adding a
// new file here + registering it in ./index.ts.
export type ManualValueKey = "sa_email" | "line_webhook_url";

export interface ManualCopyBox {
  label: string;
  /** Env-derived value, resolved server-side. Preferred for anything secret
   * or environment-specific. */
  valueKey?: ManualValueKey;
  /** Literal value for copy boxes that are neither secret nor env-derived
   * (e.g. a fixed column header list). Ignored when valueKey is set. */
  value?: string;
}

export interface ManualStep {
  n: number;
  title: string;
  body: string;
  copyBoxes?: ManualCopyBox[];
  warning?: string;
}

export interface Manual {
  slug: string;
  title: string;
  summary: string;
  steps: ManualStep[];
}
