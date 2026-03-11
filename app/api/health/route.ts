import { NextResponse } from "next/server";
import { getSupabaseConfigStatus } from "@/lib/env";

export function GET() {
  const supabase = getSupabaseConfigStatus();

  return NextResponse.json({
    name: "convertilabs",
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      supabase,
    },
  });
}
