import { NextResponse } from "next/server";
import {
  buildLivenessPayload,
  getReadinessHttpStatus,
  loadReadinessPayload,
} from "@/modules/ops/health";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("mode") === "ready") {
    const payload = await loadReadinessPayload();
    return NextResponse.json(payload, { status: getReadinessHttpStatus(payload) });
  }

  return NextResponse.json(buildLivenessPayload());
}
