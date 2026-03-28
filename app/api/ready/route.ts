import { NextResponse } from "next/server";
import {
  getReadinessHttpStatus,
  loadReadinessPayload,
} from "@/modules/ops/health";

export async function GET() {
  const payload = await loadReadinessPayload();

  return NextResponse.json(payload, { status: getReadinessHttpStatus(payload) });
}
