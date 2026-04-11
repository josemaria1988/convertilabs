import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "invite_only",
        message:
          "El acceso nuevo a Convertilabs se habilita solo por invitacion. Escribenos para solicitar una prueba sin costo.",
      },
    },
    { status: 403 },
  );
}
