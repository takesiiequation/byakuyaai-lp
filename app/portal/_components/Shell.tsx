import Image from "next/image";

// Visual twin of app/revise/[approvalId]/page.tsx's (unexported, page-local)
// Shell — duplicated rather than imported so the customer-facing revise flow
// (delicate, recently TOCTOU-patched — see MEMORY.md) stays untouched by
// portal work. Keep both in sync by eye if the brand shell changes.
export function Shell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const maxWidth = wide ? "max-w-lg lg:max-w-[1700px]" : "max-w-lg";
  const padX = wide ? "px-4 sm:px-6 lg:px-8" : "px-4 sm:px-6";
  return (
    <main className="min-h-screen bg-[var(--brand-cream)]">
      <header className="sticky top-0 z-30 w-full border-b border-[var(--brand-border)] bg-white/90 backdrop-blur-md">
        <div className="flex h-14 items-center px-4 sm:px-6">
          <Image
            src="/logo.png"
            alt="ByakuyaAI"
            width={120}
            height={36}
            className="h-7 w-auto"
          />
        </div>
      </header>
      <div className={`mx-auto py-6 sm:py-10 ${padX} ${maxWidth}`}>
        {children}
      </div>
      <p className="pb-8 text-center text-xs text-[var(--brand-gray-light)]">
        © 2026 ByakuyaAI. All rights reserved.
      </p>
    </main>
  );
}

export function MessageCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="brand-accent-bar mx-auto mb-4 h-1 w-16 rounded-full" />
      <h1 className="text-lg font-black text-[var(--brand-ink)] sm:text-xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--brand-gray)]">
        {body}
      </p>
    </div>
  );
}
