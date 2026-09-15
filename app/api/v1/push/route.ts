import { mutatePush, pushStatus } from "@/modules/push/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = pushStatus;
export const POST = (request: Request) => mutatePush(request, "subscribe");
export const DELETE = (request: Request) => mutatePush(request, "disable");
