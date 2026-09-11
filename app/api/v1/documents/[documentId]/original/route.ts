import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadEmailXmlOriginal } from "@/modules/documents/email-original";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401, headers: privateHeaders });
  const { documentId } = await context.params;
  const original = await loadEmailXmlOriginal(supabase, documentId, user.id);
  if (!original) return NextResponse.json({ error: "Original no disponible." }, { status: 404, headers: privateHeaders });
  const filename = encodeURIComponent(original.filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(new Uint8Array(original.bytes), { headers: {
    ...privateHeaders,
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="comprobante.xml"; filename*=UTF-8''${filename}`,
    "Content-Security-Policy": "sandbox; default-src 'none'",
  } });
}
