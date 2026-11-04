import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles both PKCE (?code=) and token-hash (?token_hash=&type=) magic links.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/app";
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let error: string | null = "Missing sign-in code";
  if (code) {
    error = (await supabase.auth.exchangeCodeForSession(code)).error?.message ?? null;
  } else if (tokenHash && type) {
    error = (await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error?.message ?? null;
  }
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  return NextResponse.redirect(`${origin}${next}`);
}
