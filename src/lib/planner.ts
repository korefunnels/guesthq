import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Planner = {
  id: string;
  user_id: string;
  business_name: string;
  logo_url: string | null;
  brand_colour: string;
  whatsapp_number: string | null;
};

/** Current planner (creating the row on first login). Redirects to /login if signed out. */
export async function requirePlanner() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  let { data: planner } = await supabase.from("planners").select("*").eq("user_id", userId).maybeSingle<Planner>();
  if (!planner) {
    const { data } = await supabase.from("planners").insert({ user_id: userId }).select("*").single<Planner>();
    planner = data;
  }
  if (!planner) throw new Error("Could not load planner profile");
  return { supabase, planner };
}
