import { SITE_NAME, absoluteUrl } from "./seo";
import type { Locale } from "./i18n/types";

type WebPageInput = {
  title: string;
  description: string;
  path: string;
  locale: Locale;
};

type SoftwareApplicationInput = {
  name: string;
  description: string;
  path: string;
  locale: Locale;
};

export type BreadcrumbEntry = {
  name: string;
  path: string;
};

function localeToLanguageTag(locale: Locale): string {
  return locale === "es" ? "es" : "en";
}

export function createWebSiteSchema(locale?: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: locale ? localeToLanguageTag(locale) : ["es", "en"],
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/")}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function createWebPageSchema(input: WebPageInput) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/")
    },
    inLanguage: localeToLanguageTag(input.locale)
  };
}

export function createSoftwareApplicationSchema(input: SoftwareApplicationInput) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.name,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    },
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: localeToLanguageTag(input.locale)
  };
}

export function createBreadcrumbSchema(entries: BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: absoluteUrl(entry.path)
    }))
  };
}
