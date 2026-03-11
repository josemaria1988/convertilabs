import { NextResponse } from "next/server";
import { signupUser } from "@/modules/auth/signup-service";
import type { SignupInput } from "@/modules/auth/signup-schema";

function toSignupInput(payload: unknown): SignupInput {
  if (!payload || typeof payload !== "object") {
    return {
      fullName: "",
      email: "",
      password: "",
    };
  }

  const record = payload as Record<string, unknown>;

  return {
    fullName: typeof record.fullName === "string" ? record.fullName : "",
    email: typeof record.email === "string" ? record.email : "",
    password: typeof record.password === "string" ? record.password : "",
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

  const result = await signupUser(toSignupInput(payload));

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
      },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      data: {
        status: result.status,
        email: result.email,
        message: result.message,
        next_step: result.nextStep,
      },
    },
    { status: 202 },
  );
}
