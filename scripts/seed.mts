// Demo seed: one planner, two messy weddings. Run: npm run seed
// Re-runnable: deletes the demo planner's weddings first (cascades to everything).
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const email = process.env.SEED_PLANNER_EMAIL || "demo@guesthq.test";
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Deterministic PRNG so the "mess" is the same every run (tokens stay crypto-random).
let s = 20270306;
const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const token = () => randomBytes(18).toString("base64url"); // 24 chars
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const phoneZA = () => `+27${pick(["82", "83", "72", "73", "84", "61"])}${String(Math.floor(rand() * 9e6) + 1e6)}`;
const phoneUK = () => `+447${String(Math.floor(rand() * 9e8) + 1e8)}`;

function ok(r: { error: { message: string } | null }, what: string) {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
}
async function insert(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }
}

// ───────── Planner ─────────
async function ensurePlanner() {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    const r = await db.auth.admin.createUser({ email, email_confirm: true });
    if (r.error || !r.data.user) throw new Error(`create user: ${r.error?.message}`);
    user = r.data.user;
  }
  const pr = await db
      .from("planners")
      .upsert(
        { user_id: user.id, business_name: "Bloom & Baobab Events", brand_colour: "#9d174d", whatsapp_number: "+27821234567" },
        { onConflict: "user_id" },
      )
      .select("id")
      .single<{ id: string }>();
  if (pr.error || !pr.data) throw new Error(`upsert planner: ${pr.error?.message}`);
  const planner = pr.data;
  ok(await db.from("weddings").delete().eq("planner_id", planner.id), "clear weddings");
  return planner.id as string;
}

type Ev = { id: string; key: string };
type HH = { name: string; uk?: boolean; members: { name: string; child?: number; plus?: boolean }[]; events: string[] };

async function seedWedding(
  plannerId: string,
  w: { couple: string; slug: string; start: string; end: string; location: string; deadline: string },
  events: { key: string; name: string; at: string; venue: string; dress: string }[],
  households: HH[],
  extras: (ids: { hh: { id: string; h: HH }[]; guests: Map<string, string>; weddingId: string; ev: Ev[] }) => Promise<void>,
) {
  const weddingId = randomUUID();
  await insert("weddings", [{
    id: weddingId, planner_id: plannerId, couple_names: w.couple, slug: w.slug, start_date: w.start, end_date: w.end,
    location: w.location, phase: "rsvp", rsvp_deadline: w.deadline,
  }]);
  const ev: Ev[] = events.map((e) => ({ id: randomUUID(), key: e.key }));
  await insert("events", events.map((e, i) => ({
    id: ev[i].id, wedding_id: weddingId, name: e.name, starts_at: e.at, venue: e.venue, dress_code: e.dress, sort_order: i,
  })));

  const hhRows: object[] = [], guestRows: object[] = [], invRows: object[] = [], rsvpRows: object[] = [];
  const hhIds: { id: string; h: HH }[] = [];
  const guestIdByName = new Map<string, string>();
  households.forEach((h, idx) => {
    const id = randomUUID();
    hhIds.push({ id, h });
    // ~30% of households haven't replied at all; a few replied "no" for some events.
    const pending = rand() < 0.3;
    const reminded = pending ? (idx % 7 === 0 ? daysAgo(2 + (idx % 3)) : null) : idx % 5 === 0 ? daysAgo(6) : null;
    hhRows.push({
      id, wedding_id: weddingId, name: h.name, token: token(), whatsapp_number: h.uk ? phoneUK() : phoneZA(),
      language: !h.uk && rand() < 0.2 ? "af" : "en", last_reminded_at: reminded,
    });
    for (const m of h.members) {
      const gid = randomUUID();
      guestIdByName.set(m.name, gid);
      guestRows.push({ id: gid, household_id: id, wedding_id: weddingId, full_name: m.name, is_child: m.child != null, age: m.child ?? null, is_plus_one: !!m.plus });
      for (const k of h.events) {
        const eid = ev.find((e) => e.key === k)!.id;
        invRows.push({ guest_id: gid, event_id: eid, wedding_id: weddingId });
        const status = pending ? "pending" : rand() < 0.12 ? "no" : "yes";
        rsvpRows.push({ guest_id: gid, event_id: eid, wedding_id: weddingId, status, source: rand() < 0.2 ? "assisted" : "self", updated_at: daysAgo(Math.floor(rand() * 20)) });
      }
    }
  });
  await insert("households", hhRows);
  await insert("guests", guestRows);
  await insert("invitations", invRows);
  await insert("rsvps", rsvpRows);
  await extras({ hh: hhIds, guests: guestIdByName, weddingId, ev });
  return { weddingId, hhRows: hhRows as { name: string; token: string; id: string }[], guests: guestRows.length };
}

// Mark the two oldest-chased households: pending + reminded 9+ days ago.
async function staleReminders(names: string[], hh: { id: string; h: HH }[]) {
  for (const [i, n] of names.entries()) {
    const id = hh.find((x) => x.h.name === n)!.id;
    ok(await db.from("households").update({ last_reminded_at: daysAgo(9 + i * 3) }).eq("id", id), "stale");
    const { data: g } = await db.from("guests").select("id").eq("household_id", id);
    ok(await db.from("rsvps").update({ status: "pending", source: "self" }).in("guest_id", (g ?? []).map((x) => x.id)), "stale rsvps");
  }
}

async function dietary(weddingId: string, rows: { guest: string; pref?: string; allergies?: string; sev?: string; notes?: string }[], guests: Map<string, string>, hh: { id: string; h: HH }[]) {
  await insert("dietary", rows.map((r) => ({
    guest_id: guests.get(r.guest)!, wedding_id: weddingId, preference: r.pref ?? "none", allergies: r.allergies ?? null,
    allergy_severity: r.sev ?? "none", notes: r.notes ?? null,
  })));
  // Make sure those guests' households have answered + consented (dietary data requires POPIA consent).
  const hhIds = new Set(rows.map((r) => hh.find((x) => x.h.members.some((m) => m.name === r.guest))!.id));
  await insert("consents", [...hhIds].map((id) => ({ household_id: id, wedding_id: weddingId, consented_at: daysAgo(5) })));
  for (const id of hhIds) {
    const { data: g } = await db.from("guests").select("id").eq("household_id", id);
    ok(await db.from("rsvps").update({ status: "yes" }).in("guest_id", (g ?? []).map((x) => x.id)).eq("status", "pending"), "diet rsvps");
  }
}

// ───────── Wedding 1: Thandi & Sipho (Gauteng, multi-event) ─────────
const zuluFirst = ["Thabo", "Lindiwe", "Sibusiso", "Nomvula", "Bongani", "Zanele", "Mandla", "Nokuthula", "Themba", "Ayanda", "Lerato", "Kagiso", "Palesa", "Tumelo", "Refilwe", "Sizwe", "Nandi", "Lwazi", "Busisiwe", "Khanyisile", "Mpho", "Dineo", "Tshepo", "Naledi", "Vusi", "Zodwa", "Andile", "Thulani", "Nosipho", "Sello"];
const zuluLast = ["Dlamini", "Khumalo", "Ndlovu", "Mkhize", "Zulu", "Nkosi", "Mthembu", "Sithole", "Mokoena", "Molefe", "Ngcobo", "Buthelezi", "Mahlangu", "Shabalala", "Radebe", "Cele", "Hadebe", "Maseko", "Tshabalala", "Majola"];
const kidsFirst = ["Lethabo", "Amahle", "Lwandle", "Oratile", "Siyabonga", "Wandile", "Karabo", "Melokuhle"];

function tsHouseholds(): HH[] {
  const out: HH[] = [];
  // 50 households, 140 guests. Sizes sum to 140.
  const sizes = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1];
  const used = new Set<string>();
  sizes.forEach((size, i) => {
    const last = zuluLast[i % zuluLast.length];
    const members: HH["members"] = [];
    for (let m = 0; m < size; m++) {
      let n: string;
      const isKid = size >= 3 && m >= 2 && rand() < 0.5;
      do n = `${isKid ? pick(kidsFirst) : pick(zuluFirst)} ${last}`; while (used.has(n));
      used.add(n);
      members.push(isKid ? { name: n, child: 3 + Math.floor(rand() * 10) } : { name: n, plus: size === 2 && m === 1 && i % 4 === 0 });
    }
    // Different guest lists: close family → all three; extended → umembeso + white; friends → white only.
    const events = i < 14 ? ["lobola", "umembeso", "white"] : i < 30 ? ["umembeso", "white"] : ["white"];
    out.push({ name: `${members[0].name.split(" ")[0]} ${last} household`, members, events });
  });
  // Halal friends + the nut allergy guest live in named households so dietary seed can find them.
  out[31].members[0].name = "Fatima Patel"; out[31].members[1].name = "Yusuf Patel"; out[31].name = "Patel household";
  out[32].members[0].name = "Aisha Jacobs"; out[32].members[1].name = "Imraan Jacobs"; out[32].name = "Jacobs household";
  out[5].members[2] = { name: "Khwezi Nkosi", child: 7 };
  return out;
}

// ───────── Wedding 2: Anna & Ruan (Cape Winelands destination) ─────────
const ukFirst = ["Oliver", "Charlotte", "Harry", "Amelia", "George", "Isla", "Jack", "Sophie", "James", "Emily", "William", "Grace", "Thomas", "Lucy", "Henry", "Hannah", "Edward", "Chloe", "Alfie", "Eleanor", "Freddie", "Molly", "Archie", "Poppy", "Oscar"];
const ukLast = ["Smith", "Taylor", "Brown", "Wilson", "Davies", "Evans", "Thomas", "Roberts", "Walker", "Hughes"];
const afFirst = ["Johan", "Marelize", "Pieter", "Annelie", "Hennie", "Elsabe", "Francois", "Liezl", "Gerhard", "Karin", "Werner", "Riana", "Jaco", "Mariska", "Stefan", "Nadia", "Danie", "Ilse", "Willem", "Carla"];
const afLast = ["van der Merwe", "Botha", "du Plessis", "Pretorius", "Venter", "Steyn", "Joubert", "Nel", "Fourie", "Coetzee", "Kruger", "Swanepoel", "Louw", "Malan", "Viljoen"];

function arHouseholds(): HH[] {
  const out: HH[] = [];
  const used = new Set<string>();
  const mk = (first: string[], last: string) => { let n; do n = `${pick(first)} ${last}`; while (used.has(n)); used.add(n); return n; };
  // 10 UK households = 25 guests.
  [3, 3, 3, 3, 2, 2, 2, 3, 2, 2].forEach((size, i) => {
    const last = ukLast[i];
    const members = Array.from({ length: size }, (_, m) =>
      m === 2 && i < 2 ? { name: mk(["Leo", "Ivy", "Max"], last), child: 6 + i } : { name: mk(ukFirst, last), plus: size === 2 && m === 1 && i % 3 === 0 });
    out.push({ name: `${last} family (UK)`, uk: true, members, events: ["welcome", "ceremony", "brunch"] });
  });
  // 22 SA households = 55 guests.
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2].forEach((size, i) => {
    const last = afLast[i % afLast.length];
    const members = Array.from({ length: size }, (_, m) =>
      m === 2 && i % 3 === 0 ? { name: mk(["Mia", "Ruben", "Zoë", "Liam"], last), child: 4 + (i % 9) } : { name: mk(afFirst, last), plus: size === 2 && m === 1 && i % 5 === 0 });
    const events = i < 9 ? ["welcome", "ceremony", "brunch"] : i < 15 ? ["ceremony", "brunch"] : ["ceremony"];
    out.push({ name: `${last[0].toUpperCase()}${last.slice(1)} household`, members, events });
  });
  out[10].members[0].name = "Megan du Plessis"; // vegan
  out[11].members[1].name = "Zainab Hendricks"; out[11].name = "Hendricks household"; // halal
  out[3].members[0].name = "Rupert Roberts"; // severe nut allergy (UK)
  return out;
}

async function main() {
  const plannerId = await ensurePlanner();

  const tsHH = tsHouseholds();
  const ts = await seedWedding(
    plannerId,
    { couple: "Thandi & Sipho", slug: "thandi-sipho", start: "2027-03-06", end: "2027-03-27", location: "Gauteng", deadline: "2027-02-01" },
    [
      { key: "lobola", name: "Lobola", at: "2027-03-06T10:00:00+02:00", venue: "Mkhize family home, Soweto", dress: "Traditional / smart" },
      { key: "umembeso", name: "Umembeso", at: "2027-03-13T11:00:00+02:00", venue: "Dlamini family home, Tembisa", dress: "Traditional Zulu attire" },
      { key: "white", name: "White wedding", at: "2027-03-27T14:00:00+02:00", venue: "Shepstone Gardens, Johannesburg", dress: "Black tie — gold accents" },
    ],
    tsHH,
    async ({ hh, guests, weddingId }) => {
      await staleReminders([tsHH[40].name, tsHH[44].name], hh);
      await dietary(weddingId, [
        { guest: "Fatima Patel", pref: "halal" },
        { guest: "Yusuf Patel", pref: "halal" },
        { guest: "Aisha Jacobs", pref: "halal", allergies: "Shellfish", sev: "mild" },
        { guest: "Imraan Jacobs", pref: "halal" },
        { guest: "Khwezi Nkosi", allergies: "Peanuts and tree nuts — carries EpiPen", sev: "severe", notes: "Child, age 7" },
        { guest: tsHH[2].members[0].name, pref: "vegetarian" },
        { guest: tsHH[7].members[1].name, allergies: "Lactose", sev: "mild" },
      ], guests, hh);
    },
  );

  const arHH = arHouseholds();
  const ar = await seedWedding(
    plannerId,
    { couple: "Anna & Ruan", slug: "anna-ruan", start: "2027-04-16", end: "2027-04-18", location: "Franschhoek, Cape Winelands", deadline: "2027-02-15" },
    [
      { key: "welcome", name: "Welcome dinner", at: "2027-04-16T19:00:00+02:00", venue: "The Cellar, Rooiberg Wine Estate", dress: "Smart casual" },
      { key: "ceremony", name: "Ceremony & reception", at: "2027-04-17T15:30:00+02:00", venue: "Oak Chapel, Rooiberg Wine Estate", dress: "Garden formal — flat shoes for lawn" },
      { key: "brunch", name: "Farewell brunch", at: "2027-04-18T10:30:00+02:00", venue: "Rooiberg Deli Garden", dress: "Casual" },
    ],
    arHH,
    async ({ hh, guests, weddingId }) => {
      const blocks = [
        { id: randomUUID(), wedding_id: weddingId, name: "Rooiberg Guest Cottages", rooms_total: 15, deadline: "2027-02-28" },
        { id: randomUUID(), wedding_id: weddingId, name: "Franschhoek Village Hotel", rooms_total: 12, deadline: "2027-03-05" },
      ];
      await insert("accommodation_blocks", blocks);
      const flightsIn = ["BA 59", "VS 449", "BA 59", "EK 772", "BA 59", "VS 449", "KL 597", "BA 59", "QR 1369", "BA 59"];
      const flightsOut = ["BA 58", "VS 448", "BA 58", "EK 773", "BA 58", "VS 448", "KL 598", "BA 58", "QR 1370", "BA 58"];
      const travel = hh.slice(0, 22).map(({ id, h }, i) => ({
        household_id: id, wedding_id: weddingId,
        arrival_at: h.uk ? `2027-04-${i % 3 === 0 ? 14 : 15}T${["07:30", "09:45", "11:10"][i % 3]}:00+02:00` : `2027-04-16T${["12:00", "14:30", "16:00"][i % 3]}:00+02:00`,
        arrival_flight: h.uk ? flightsIn[i] : i % 4 === 0 ? "FA 241" : null,
        departure_at: h.uk ? `2027-04-${i % 2 ? 19 : 20}T${["18:40", "21:15"][i % 2]}:00+02:00` : "2027-04-18T14:00:00+02:00",
        departure_flight: h.uk ? flightsOut[i] : null,
        needs_transfer: h.uk || i % 4 === 0,
        accommodation_block_id: i < 13 ? blocks[0].id : i < 21 ? blocks[1].id : null,
      }));
      await insert("travel", travel);
      await staleReminders([arHH[28].name], hh);
      await dietary(weddingId, [
        { guest: "Megan du Plessis", pref: "vegan" },
        { guest: "Zainab Hendricks", pref: "halal" },
        { guest: "Rupert Roberts", allergies: "Tree nuts & peanuts — anaphylactic", sev: "severe" },
        { guest: arHH[1].members[0].name, pref: "vegetarian" },
        { guest: arHH[14].members[0].name, pref: "other", notes: "Gluten-free (coeliac)", allergies: "Gluten", sev: "mild" },
      ], guests, hh);
    },
  );

  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = link?.properties?.hashed_token;

  console.log(`\n✓ Seeded planner ${email}`);
  console.log(`  Thandi & Sipho: ${ts.guests} guests, ${ts.hhRows.length} households`);
  console.log(`  Anna & Ruan:    ${ar.guests} guests, ${ar.hhRows.length} households`);
  if (hashed) console.log(`\nPlanner login (single use):\n  ${site}/auth/callback?token_hash=${hashed}&type=magiclink&next=/app`);
  console.log(`\nSample guest links:`);
  for (const h of [...ts.hhRows.slice(0, 2), ...ar.hhRows.slice(0, 2)]) console.log(`  ${h.name.padEnd(32)} ${site}/g/${h.token}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
