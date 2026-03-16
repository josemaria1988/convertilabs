import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    message: "El MVP V1 no expone borradores de centros de costo.",
  }, {
    status: 410,
  });
}
