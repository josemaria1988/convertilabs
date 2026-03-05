import type { AlternateUrl, Locale, RouteKey } from "./types";

export const routePaths: Record<RouteKey, Record<Locale, string>> = {
  home: { es: "/es/", en: "/en/" },
  inches: { es: "/es/pulgadas-a-milimetros/", en: "/en/inches-to-millimeters/" },
  liters: { es: "/es/litros-a-galones/", en: "/en/liters-to-gallons/" },
  cubic: { es: "/es/metros-cubicos/", en: "/en/cubic-meters/" },
  about: { es: "/es/sobre/", en: "/en/about/" },
  contact: { es: "/es/contacto/", en: "/en/contact/" },
  privacy: { es: "/es/privacidad/", en: "/en/privacy-policy/" },
  terms: { es: "/es/terminos/", en: "/en/terms/" }
};

export const navRouteKeys: RouteKey[] = ["home", "inches", "liters", "cubic", "about", "contact"];
export const legalRouteKeys: RouteKey[] = ["privacy", "terms"];

export function getPath(locale: Locale, routeKey: RouteKey): string {
  return routePaths[routeKey][locale];
}

export function getAlternateUrls(routeKey: RouteKey): AlternateUrl[] {
  return [
    { locale: "es", path: routePaths[routeKey].es },
    { locale: "en", path: routePaths[routeKey].en },
    { locale: "x-default", path: "/" }
  ];
}
