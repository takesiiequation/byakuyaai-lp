import type { Metadata } from "next";
import { Shell } from "../_components/Shell";
import LoginForm from "../_components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "マイページログイン",
  robots: { index: false, follow: false },
};

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
    <Shell>
      <LoginForm initialClientId={initialClientId} />
    </Shell>
  );
}
