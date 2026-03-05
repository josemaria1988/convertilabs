# ConvertiLab

Mini servicio SaaS de conversiones tecnicas construido con Astro + TypeScript.

## URLs incluidas

- `/`
- `/es/`
- `/es/pulgadas-a-milimetros/`
- `/es/litros-a-galones/`
- `/es/metros-cubicos/`
- `/es/sobre/`
- `/es/contacto/`
- `/es/privacidad/`
- `/es/terminos/`
- `/en/`
- `/en/inches-to-millimeters/`
- `/en/liters-to-gallons/`
- `/en/cubic-meters/`
- `/en/about/`
- `/en/contact/`
- `/en/privacy-policy/`
- `/en/terms/`
- `/robots.txt`
- `/sitemap.xml`
- `/api/locale` (Cloudflare Pages Function)

## Requisitos

- Node.js 20+
- npm 10+

## Desarrollo local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Variables de entorno

Copia `.env.example` a `.env` y completa segun corresponda:

- `PUBLIC_GA4_ID`: medicion GA4 opcional.
- `PUBLIC_CF_WEB_ANALYTICS_TOKEN`: token de Cloudflare Web Analytics.
- `PUBLIC_ADSENSE_CLIENT_ID`: cliente de AdSense.
- `PUBLIC_ADSENSE_SLOT_HOME_LEFT`: banner vertical izquierdo de home.
- `PUBLIC_ADSENSE_SLOT_HOME_MIDDLE`: banner medio de home.
- `PUBLIC_ADSENSE_SLOT_HOME_RIGHT`: banner vertical derecho de home.
- `PUBLIC_ADSENSE_SLOT_*`: IDs de slots manuales por posicion.

## Deploy en Cloudflare Pages

1. Conecta el repo en Cloudflare Pages.
2. Configura:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Carga variables `PUBLIC_*` en el panel de Pages.
4. El endpoint `functions/api/locale.ts` queda disponible como `/api/locale` en Pages.
5. Enlaza el dominio final en Cloudflare Registrar y habilita HTTPS.

## Checklist SEO inicial

- Metadata unica por URL.
- Canonical en todas las paginas.
- `hreflang` para ES, EN y `x-default`.
- JSON-LD (WebSite, WebPage, SoftwareApplication, BreadcrumbList).
- `robots.txt` y `sitemap.xml`.
- Enlaces internos entre herramientas.
