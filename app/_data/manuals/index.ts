import type { Manual } from "./types";
import { lineSetupManual } from "./line-setup";

// Registry: add a new manual by writing its file (mirroring line-setup.ts)
// and appending it here. Everything else (list page, detail page, copy
// boxes) reads from this array.
export const manuals: Manual[] = [lineSetupManual];

export function getManualBySlug(slug: string): Manual | undefined {
  return manuals.find((m) => m.slug === slug);
}

export type { Manual, ManualStep, ManualCopyBox, ManualValueKey } from "./types";
