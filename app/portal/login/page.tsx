import type { Metadata } from "next";
import Image from "next/image";
import LoginBackdrop from "../_components/LoginBackdrop";
import LoginForm from "../_components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "マイページログイン",
  robots: { index: false, follow: false },
};

// Deliberately NOT the shared <Shell> from ../_components/Shell — that
// component also renders the /portal dashboard (white background, must
// stay untouched). This page needs a full-bleed dark video backdrop with a
// transparent header, so it gets its own minimal layout instead of adding
// a branching prop to the shared one (same "duplicate, don't entangle"
// precedent Shell.tsx itself documents against app/revise's Shell twin).
export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  // client_id is already publicly exposed as the /go/[client] path segment
  // (see docs/property_db_f_design.md §P1.3), so prefilling it from a query
  // param adds no new leak. The password field is never prefilled/queried.
  const { c } = await searchParams;
  const initialClientId = typeof c === "string" ? c : "";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b0b0f]">
      <LoginBackdrop />
      {/* #0b0b0f 25%スクリム — 動画の明部で白文字が飛ぶのを防ぐ(WCAG優先) */}
      <div className="absolute inset-0 z-[1] bg-[#0b0b0f]/25" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex h-14 items-center px-4 sm:px-6">
          <Image
            src="/logo.png"
            alt="ByakuyaAI"
            width={120}
            height={36}
            className="h-7 w-auto"
            style={{ filter: "brightness(0) invert(1)" }}
            priority
          />
        </header>

        <div className="flex flex-1 items-center justify-center px-4 py-6">
          <LoginForm initialClientId={initialClientId} />
        </div>

        <p className="pb-8 text-center text-xs text-white/50">
          © 2026 ByakuyaAI. All rights reserved.
        </p>
      </div>
    </main>
  );
}
