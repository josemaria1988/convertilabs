import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  logAuthEvent,
  logSupabaseAuthError,
} from "@/modules/auth/auth-logging";
import {
  getAuthStateForUser,
  normalizeNextPath,
  resolvePostAuthDestination,
} from "@/modules/auth/server-auth";

const validEmailOtpTypes: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string): value is EmailOtpType {
  return validEmailOtpTypes.includes(value as EmailOtpType);
}

function redirectToLogin(request: Request, authMessage: string) {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("auth_message", authMessage);
  return NextResponse.redirect(redirectUrl, { status: 303 });
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = normalizeNextPath(requestUrl.searchParams.get("next"));

  if (!tokenHash || !type || !isEmailOtpType(type)) {
    logAuthEvent("warn", "confirm_invalid_request", {
      hasTokenHash: Boolean(tokenHash),
      rawType: type,
      hasNext: Boolean(next),
    });
    return redirectToLogin(request, "invalid_confirmation_link");
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error || !data.user) {
    logSupabaseAuthError("warn", "confirm_verify_failed", error, {
      type,
      hasUser: Boolean(data.user),
      hasNext: Boolean(next),
    });
    return redirectToLogin(request, "invalid_confirmation_link");
  }

  const authState = await getAuthStateForUser(supabase, data.user);
  const destination = resolvePostAuthDestination(authState, next);

  return NextResponse.redirect(new URL(destination, request.url), {
    status: 303,
  });
}
