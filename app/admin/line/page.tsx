import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/app/_lib/auth";
import LineKnowledgeClient from "./LineKnowledgeClient";

export const dynamic = "force-dynamic";

async function checkAuth() {
  const jar = await cookies();
  const session = jar.get("admin-session")?.value;
  if (!session || !verifySession(session)) redirect("/admin/login");
}

export default async function LineKnowledgePage() {
  await checkAuth();
  return <LineKnowledgeClient />;
}
