export type Locale = "es" | "en";

export type RouteKey =
  | "home"
  | "inches"
  | "liters"
  | "cubic"
  | "about"
  | "contact"
  | "privacy"
  | "terms";

export type AlternateLocale = Locale | "x-default";

export type AlternateUrl = {
  locale: AlternateLocale;
  path: string;
};
