/// <reference types="astro/client" />

declare global {
  interface Window {
    trackEvent?: (eventName: string, params?: Record<string, unknown>) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    adsbygoogle?: unknown[];
  }
}

export {};
