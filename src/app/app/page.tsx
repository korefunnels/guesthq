import Link from "next/link";
import { requirePlanner } from "@/lib/planner";
import { fmtDate } from "@/lib/format";

export default async function WeddingsPage() {
  const { supabase, planner } = await requirePlanner();
  const { data: weddings } = await supabase
    .from("weddings")
    .select("id, couple_names, start_date, end_date, location, phase, households(count), guests(count)")
    .eq("planner_id", planner.id)
    .order("start_date");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Weddings</h1>
      {!weddings?.length && <p className="text-stone-600">No weddings yet. Run <code>npm run seed</code> for demo data.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {weddings?.map((w) => {
          const households = (w.households as unknown as { count: number }[])[0]?.count ?? 0;
          const guests = (w.guests as unknown as { count: number }[])[0]?.count ?? 0;
          return (
            <li key={w.id}>
              <Link href={`/app/w/${w.id}`} className="block rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-400">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{w.couple_names}</h2>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs uppercase tracking-wide">{w.phase}</span>
                </div>
                <p className="text-sm text-stone-600">{w.location}</p>
                <p className="text-sm text-stone-600">{fmtDate(w.start_date)}{w.end_date && w.end_date !== w.start_date ? ` – ${fmtDate(w.end_date)}` : ""}</p>
                <p className="mt-2 text-sm">{guests} guests · {households} households</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
