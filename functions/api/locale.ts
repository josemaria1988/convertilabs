type SuggestedLocale = "es" | "en";

const SPANISH_MARKETS = new Set([
  "AR",
  "BO",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "ES",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PR",
  "PY",
  "SV",
  "UY",
  "VE"
]);

function resolveCountry(context: any): string | null {
  const headerCountry = context.request.headers.get("CF-IPCountry");
  if (headerCountry && headerCountry !== "XX") {
    return headerCountry.toUpperCase();
  }

  const cfCountry = (context.request as Request & { cf?: { country?: string } }).cf?.country;
  if (cfCountry && cfCountry !== "XX") {
    return cfCountry.toUpperCase();
  }

  return null;
}

function inferLocale(country: string | null): SuggestedLocale {
  if (!country) {
    return "en";
  }
  return SPANISH_MARKETS.has(country) ? "es" : "en";
}

export const onRequestGet = async (context: any) => {
  const country = resolveCountry(context);
  const suggestedLocale = inferLocale(country);

  return new Response(JSON.stringify({ country, suggestedLocale }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
};
