import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlanner } from "@/lib/planner";
import { fmtDate, fmtDateTime } from "@/lib/format";

export default async function WeddingOverview({ params }: PageProps<"/app/w/[id]">) {
  const { id } = await params;
  const { supabase } = await requirePlanner();

  const { data: wedding } = await supabase.from("weddings").select("*").eq("id", id).maybeSingle();
  if (!wedding) notFound();

  const [{ data: events }, { data: rsvps }, { data: severe }, { data: blocks }, { data: travel }] = await Promise.all([
    supabase.from("events").select("id, name, starts_at, venue").eq("wedding_id", id).order("sort_order"),
    supabase.from("rsvps").select("event_id, status").eq("wedding_id", id),
    supabase.from("dietary").select("guest_id").eq("wedding_id", id).eq("allergy_severity", "severe"),
    supabase.from("accommodation_blocks").select("id, rooms_total").eq("wedding_id", id),
    supabase.from("travel").select("accommodation_block_id").eq("wedding_id", id).not("accommodation_block_id", "is", null),
  ]);

  const counts = new Map<string, { yes: number; no: number; pending: number }>();
  for (const r of rsvps ?? []) {
    const c = counts.get(r.event_id) ?? { yes: 0, no: 0, pending: 0 };
    c[r.status as "yes" | "no" | "pending"]++;
    counts.set(r.event_id, c);
  }
  const roomsTotal = (blocks ?? []).reduce((s, b) => s + b.rooms_total, 0);
  const roomsUsed = travel?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app" className="text-sm text-stone-500">← Weddings</Link>
        <h1 className="text-2xl font-semibold">{wedding.couple_names}</h1>
        <p className="text-sm text-stone-600">
          {wedding.location} · {fmtDate(wedding.start_date)} · phase <b className="uppercase">{wedding.phase}</b>
          {wedding.rsvp_deadline && <> · RSVP by {fmtDate(wedding.rsvp_deadline)}</>}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Severe allergies" value={severe?.length ?? 0} alert={(severe?.length ?? 0) > 0} />
        <Stat label="Rooms used" value={blocks?.length ? `${roomsUsed} / ${roomsTotal}` : "—"} />
        <Stat label="Still waiting (guest-events)" value={[...counts.values()].reduce((s, c) => s + c.pending, 0)} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Events</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events?.map((e) => {
            const c = counts.get(e.id) ?? { yes: 0, no: 0, pending: 0 };
            return (
              <li key={e.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <h3 className="font-medium">{e.name}</h3>
                <p className="text-xs text-stone-500">{fmtDateTime(e.starts_at)} · {e.venue}</p>
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="text-emerald-700"><b className="text-lg">{c.yes}</b> yes</span>
                  <span className="text-stone-500"><b className="text-lg">{c.no}</b> no</span>
                  <span className="text-amber-700"><b className="text-lg">{c.pending}</b> pending</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-red-300 bg-red-50 text-red-900" : "border-stone-200 bg-white"}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
