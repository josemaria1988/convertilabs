import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function buildLogoutRedirect(request: Request) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("auth_message", "signed_out");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

async function signOutAndRedirect(request: Request) {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  return buildLogoutRedirect(request);
}

export async function GET(request: Request) {
  return signOutAndRedirect(request);
}

export async function POST(request: Request) {
  return signOutAndRedirect(request);
}
