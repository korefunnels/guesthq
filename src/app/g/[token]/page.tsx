import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getHouseholdByToken } from "@/lib/guest";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function GuestPage({ params }: PageProps<"/g/[token]">) {
  const { token } = await params;
  const ctx = await getHouseholdByToken(token);
  if (!ctx) notFound();
  const { db, household, wedding, planner } = ctx;

  const { data: guests } = await db
    .from("guests")
    .select("id, full_name, is_child")
    .eq("household_id", household.id)
    .order("created_at");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="text-center" style={{ color: planner.brand_colour }}>
        <p className="text-xs uppercase tracking-widest">You&apos;re invited</p>
        <h1 className="text-3xl font-semibold">{wedding.couple_names}</h1>
        <p className="text-sm text-stone-600">{wedding.location} · {fmtDate(wedding.start_date)}</p>
      </header>
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="font-medium">{household.name}</h2>
        <ul className="mt-2 text-sm text-stone-700">
          {guests?.map((g) => <li key={g.id}>{g.full_name}{g.is_child ? " (child)" : ""}</li>)}
        </ul>
      </section>
      <p className="text-center text-xs text-stone-400">Phase: {wedding.phase}</p>
    </main>
  );
}
