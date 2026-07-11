import type { ManualValueKey } from "@/app/_data/manuals/types";

// Server-only resolution of manual "copy box" values from env, so no secret
// or n8n endpoint URL is ever hardcoded in the (public repo) manual data
// files under app/_data/manuals/. Fail-soft by design: any missing or
// malformed env value resolves to "" and the page renders "(env未設定)"
// instead of throwing — a half-configured environment must never 500 this
// page, since it's the page an operator opens *to finish* configuring things.
export function resolveManualValue(key: ManualValueKey): string {
  switch (key) {
    case "sa_email": {
      const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!raw) return "";
      try {
        const json = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
        return typeof json?.client_email === "string" ? json.client_email : "";
      } catch {
        return "";
      }
    }
    case "line_webhook_url": {
      // REVISE_INFO_URL is an existing server-only env var pointing at the
      // n8n backend relay (see _lib/revise.ts). The LINE AI webhook lives on
      // the same n8n instance, at a fixed path — derive origin, don't
      // hardcode the host.
      const base = process.env.REVISE_INFO_URL;
      if (!base) return "";
      try {
        return `${new URL(base).origin}/webhook/line-ai`;
      } catch {
        return "";
      }
    }
    default:
      return "";
  }
}
