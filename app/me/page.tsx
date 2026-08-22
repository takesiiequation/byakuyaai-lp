import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isMeAuthed } from "@/app/_lib/meAuth";
import Tracker from "./_components/Tracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "85点の毎日",
  robots: { index: false, follow: false },
};

export default async function MePage() {
  if (!(await isMeAuthed())) redirect("/me/login");
  return <Tracker />;
}
