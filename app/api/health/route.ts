import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "convertilabs",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
