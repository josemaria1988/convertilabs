import { mutatePush } from "@/modules/push/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (request: Request) => mutatePush(request, "test");
