import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { getManualBySlug } from "@/app/_data/manuals";
import { resolveManualValue } from "@/app/_lib/manualValues";
import CopyBox from "../../_components/CopyBox";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

export default async function ManualDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await checkAuth();
  const { slug } = await params;

  const manual = getManualBySlug(slug);
  if (!manual) notFound();

  // Copy-box values are resolved here (server-side, per request) from env —
  // never baked into the app/_data/manuals/*.ts files, which live in a
  // public repo. See app/_lib/manualValues.ts.
  const steps = manual.steps.map((s) => ({
    ...s,
    copyBoxes: s.copyBoxes?.map((b) => ({
      label: b.label,
      value: b.valueKey ? resolveManualValue(b.valueKey) : (b.value ?? ""),
    })),
  }));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <a
          href="/admin/manual"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)] active:scale-95 transition-all"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </a>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-[var(--brand-ink)] truncate">
            {manual.title}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{manual.summary}</p>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((s) => (
          <div
            key={s.n}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[var(--brand-orange)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {s.n}
              </span>
              <h2 className="font-bold text-sm text-[var(--brand-ink)]">
                {s.title}
              </h2>
            </div>
            <div className="p-4 sm:p-6">
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {s.body}
              </p>
              {s.copyBoxes?.map((b) => (
                <CopyBox key={b.label} label={b.label} value={b.value} />
              ))}
              {s.warning && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ {s.warning}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
