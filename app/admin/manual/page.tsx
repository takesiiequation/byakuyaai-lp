import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import { manuals } from "@/app/_data/manuals";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

export default async function ManualListPage() {
  await checkAuth();

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-[var(--brand-ink)] mb-5">
        マニュアル
      </h1>

      {manuals.length === 0 ? (
        <p className="text-sm text-gray-400">まだマニュアルがありません。</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {manuals.map((m) => (
            <a
              key={m.slug}
              href={`/admin/manual/${m.slug}`}
              className="group bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 hover:shadow-md active:scale-[0.98] transition-all"
            >
              <h2 className="font-bold text-[15px] sm:text-base text-[var(--brand-ink)] group-hover:text-[var(--brand-orange)] transition-colors">
                {m.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{m.summary}</p>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {m.steps.length} ステップ
                </span>
                <span className="text-xs text-gray-400 group-hover:text-[var(--brand-orange)] transition-colors">
                  開く →
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
