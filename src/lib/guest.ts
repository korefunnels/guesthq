import { createAdminClient } from "@/lib/supabase/admin";

export type Phase = "invite" | "rsvp" | "travel" | "live";

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;

/**
 * Validates a household token server-side and returns the household + wedding + planner.
 * Returns null for anything that isn't a real token. Every guest read/write must go through this.
 */
export async function getHouseholdByToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("households")
    .select(
      "id, name, language, wedding_id, weddings!inner(id, couple_names, start_date, end_date, location, phase, rsvp_deadline, consent_text, planners!inner(business_name, logo_url, brand_colour, whatsapp_number))",
    )
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  type W = {
    id: string; couple_names: string; start_date: string | null; end_date: string | null;
    location: string | null; phase: Phase; rsvp_deadline: string | null; consent_text: string;
    planners: { business_name: string; logo_url: string | null; brand_colour: string; whatsapp_number: string | null };
  };
  const wedding = data.weddings as unknown as W;
  return {
    db,
    household: { id: data.id as string, name: data.name as string, language: data.language as "en" | "af" },
    wedding,
    planner: wedding.planners,
  };
}
