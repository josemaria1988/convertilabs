import { NextResponse } from "next/server";
import { loginUser } from "@/modules/auth/login-service";
import type { LoginInput } from "@/modules/auth/login-schema";

function toLoginInput(payload: unknown): LoginInput {
  if (!payload || typeof payload !== "object") {
    return {
      email: "",
      password: "",
    };
  }

  const record = payload as Record<string, unknown>;

  return {
    email: typeof record.email === "string" ? record.email : "",
    password: typeof record.password === "string" ? record.password : "",
    next: typeof record.next === "string" ? record.next : undefined,
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "invalid_json",
          message: "El cuerpo de la solicitud debe ser JSON valido.",
        },
      },
      { status: 400 },
    );
  }

  const result = await loginUser(toLoginInput(payload));

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({
    data: {
      status: result.status,
      message: result.message,
      redirect_to: result.redirectTo,
    },
  });
}
