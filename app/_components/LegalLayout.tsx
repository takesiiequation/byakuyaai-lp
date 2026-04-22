import Link from "next/link";
import Image from "next/image";

export function LegalLayout({
  title,
  effectiveAt,
  updatedAt,
  children,
}: {
  title: string;
  effectiveAt: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--brand-cream)]">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="ByakuyaAI"
              width={120}
              height={36}
              className="h-7 w-auto"
            />
          </Link>
          <Link
            href="/"
            className="text-xs font-bold text-[var(--brand-gray)] transition hover:text-[var(--brand-orange)] sm:text-sm"
          >
            ← トップへ戻る
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-10">
          <div className="brand-accent-bar mb-6 h-1 w-16 rounded-full" />
          <h1 className="text-2xl font-black tracking-tight text-[var(--brand-ink)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-3 text-xs text-[var(--brand-gray-light)] sm:text-sm">
            制定日: {effectiveAt}　/　最終改定日: {updatedAt}
          </p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-[var(--brand-ink)] sm:text-[15px] sm:leading-8">
            {children}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-[var(--brand-gray-light)]">
          © 2026 ByakuyaAI. All rights reserved.
        </p>
      </article>
    </main>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 border-l-4 border-[var(--brand-orange)] pl-3 text-base font-bold text-[var(--brand-ink)] sm:text-lg">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 text-sm font-bold text-[var(--brand-ink)] sm:text-base">
      {children}
    </h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[var(--brand-gray)]">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-[var(--brand-gray)]">
      {children}
    </ul>
  );
}

export function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="ml-5 list-decimal space-y-1.5 text-[var(--brand-gray)]">
      {children}
    </ol>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-l-4 border-[var(--brand-orange)] bg-[var(--brand-cream)] p-4 text-xs text-[var(--brand-ink)] sm:text-sm">
      {children}
    </div>
  );
}

export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="bg-[var(--brand-cream)]">
            {head.map((h, i) => (
              <th
                key={i}
                className="border border-[var(--brand-border)] px-3 py-2 text-left font-bold text-[var(--brand-ink)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td
                  key={j}
                  className="border border-[var(--brand-border)] px-3 py-2 align-top text-[var(--brand-gray)]"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
