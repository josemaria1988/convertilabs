import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "invite_only",
        message:
          "Convertilabs es una herramienta interna de Rontil. El registro público está cerrado.",
      },
    },
    { status: 403 },
  );
}
