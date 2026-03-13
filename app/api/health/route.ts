import { NextResponse } from "next/server";
import {
  getInngestConfigStatus,
  getOpenAIConfigStatus,
  getSupabaseConfigStatus,
} from "@/lib/env";

export function GET() {
  const supabase = getSupabaseConfigStatus();
  const openai = getOpenAIConfigStatus();
  const inngest = getInngestConfigStatus();

  return NextResponse.json({
    name: "convertilabs",
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      supabase,
      openai,
      inngest,
    },
  });
}
