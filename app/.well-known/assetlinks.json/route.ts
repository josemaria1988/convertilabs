import { NextResponse } from "next/server";

function splitFingerprints(value: string | undefined) {
  return (value ?? "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  const packageName = process.env.TWA_ANDROID_PACKAGE_NAME ?? "";
  const fingerprints = splitFingerprints(process.env.TWA_SHA256_FINGERPRINTS);
  const payload =
    packageName && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
