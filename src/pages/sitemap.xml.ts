import { SITE_URL } from "../lib/seo";
import { routePaths } from "../lib/i18n/routes";
import type { Locale, RouteKey } from "../lib/i18n/types";

type SitemapEntry = {
  loc: string;
  alternates: Array<{ hreflang: string; href: string }>;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: string;
};

const routeChangefreq: Record<RouteKey, SitemapEntry["changefreq"]> = {
  home: "weekly",
  inches: "weekly",
  liters: "weekly",
  cubic: "weekly",
  about: "monthly",
  contact: "monthly",
  privacy: "yearly",
  terms: "yearly"
};

const routePriority: Record<RouteKey, string> = {
  home: "1.0",
  inches: "0.9",
  liters: "0.9",
  cubic: "0.9",
  about: "0.5",
  contact: "0.4",
  privacy: "0.3",
  terms: "0.3"
};

function toAbsolute(path: string): string {
  return new URL(path, SITE_URL).toString();
}

function getAlternates(routeKey: RouteKey) {
  return [
    { hreflang: "es", href: toAbsolute(routePaths[routeKey].es) },
    { hreflang: "en", href: toAbsolute(routePaths[routeKey].en) },
    { hreflang: "x-default", href: toAbsolute("/") }
  ];
}

function getRouteEntries(routeKey: RouteKey): SitemapEntry[] {
  const alternates = getAlternates(routeKey);
  const locales: Locale[] = ["es", "en"];

  return locales.map((locale) => ({
    loc: toAbsolute(routePaths[routeKey][locale]),
    alternates,
    changefreq: routeChangefreq[routeKey],
    priority: routePriority[routeKey]
  }));
}

function buildXml(entries: SitemapEntry[]) {
  const urls = entries
    .map((entry) => {
      const alternateLinks = entry.alternates
        .map(
          (alternate) =>
            `<xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${alternate.href}" />`
        )
        .join("");

      return `<url><loc>${entry.loc}</loc>${alternateLinks}<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
    `<url><loc>${toAbsolute("/")}</loc><xhtml:link rel="alternate" hreflang="es" href="${toAbsolute("/es/")}" /><xhtml:link rel="alternate" hreflang="en" href="${toAbsolute("/en/")}" /><xhtml:link rel="alternate" hreflang="x-default" href="${toAbsolute("/")}" /><changefreq>weekly</changefreq><priority>1.0</priority></url>` +
    urls +
    `</urlset>`;
}

export function GET() {
  const routeKeys = Object.keys(routePaths) as RouteKey[];
  const entries = routeKeys.flatMap((routeKey) => getRouteEntries(routeKey));
  const body = buildXml(entries);

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
