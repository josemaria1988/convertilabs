import type { NextRequest } from "next/server";
import { redirectWithSupabaseCookies, updateSupabaseSession } from "@/lib/supabase/middleware";

const privateRoutePrefixes = [
  "/app",
  "/dashboard",
  "/documents",
  "/journal-entries",
  "/tax",
  "/settings",
  "/onboarding",
];

function isPrivateRoute(pathname: string) {
  return privateRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);

  if (!user && isPrivateRoute(request.nextUrl.pathname)) {
    const loginPath = `/login?next=${encodeURIComponent(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )}`;

    return redirectWithSupabaseCookies(loginPath, request, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/dashboard/:path*",
    "/documents/:path*",
    "/journal-entries/:path*",
    "/tax/:path*",
    "/settings/:path*",
    "/onboarding",
    "/login",
    "/signup",
  ],
};
