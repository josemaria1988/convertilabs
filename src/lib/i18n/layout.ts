import type { Locale, RouteKey } from "./types";

type LayoutStrings = {
  navAriaLabel: string;
  legalAriaLabel: string;
  languageToggleLabel: string;
  footerClaim: string;
  navLabels: Record<RouteKey, string>;
  localeNames: Record<Locale, string>;
};

export const layoutStrings: Record<Locale, LayoutStrings> = {
  es: {
    navAriaLabel: "Navegacion principal",
    legalAriaLabel: "Navegacion legal",
    languageToggleLabel: "Idioma",
    footerClaim: "Herramientas de conversion para trabajo real.",
    navLabels: {
      home: "Inicio",
      inches: "Pulgadas a mm",
      liters: "Litros a galones",
      cubic: "Metros cubicos",
      about: "Sobre",
      contact: "Contacto",
      privacy: "Privacidad",
      terms: "Terminos"
    },
    localeNames: {
      es: "ES",
      en: "EN"
    }
  },
  en: {
    navAriaLabel: "Main navigation",
    legalAriaLabel: "Legal navigation",
    languageToggleLabel: "Language",
    footerClaim: "Practical conversion tools for real operations.",
    navLabels: {
      home: "Home",
      inches: "Inches to mm",
      liters: "Liters to gallons",
      cubic: "Cubic meters",
      about: "About",
      contact: "Contact",
      privacy: "Privacy",
      terms: "Terms"
    },
    localeNames: {
      es: "ES",
      en: "EN"
    }
  }
};
