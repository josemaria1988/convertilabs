# DOCUMENTACION DEL PROYECTO CONVERTILAB

## 0) TL;DR (lectura de 60 segundos)

- Proyecto: sitio bilingue ES/EN para conversiones tecnicas.
- Stack: Astro + TypeScript + CSS nativo + JS vanilla + Cloudflare Pages Functions.
- URL base neutral: `/` (selector de idioma + sugerencia, sin redireccion forzada).
- Arbol indexable:
  - ES: `/es/...`
  - EN: `/en/...`
- SEO internacional:
  - canonical por locale
  - hreflang `es`, `en`, `x-default`
  - JSON-LD por pagina
  - `sitemap.xml` generado dinamicamente
  - `robots.txt` apuntando a sitemap
- I18n:
  - toggle `ES | EN` en header
  - mapeo por `routeKey` entre pares ES/EN
  - persistencia con `localStorage.preferredLocale`
- Sugerencia de idioma:
  - navegador (`navigator.languages`)
  - geolocalizacion Cloudflare (`/api/locale`)
  - solo sugiere, no redirige automaticamente
- Monetizacion:
  - slots manuales AdSense
  - 3 banners en home (left vertical, middle, right vertical)
  - banners por landing de herramienta (top/bottom)
- Estado actual de calidad:
  - `npm run check` OK
  - `npm run build` OK

---

## 1) Objetivo funcional

ConvertiLab es un micro-SaaS de herramientas de conversion orientado a trafico organico global y monetizacion publicitaria no invasiva.

Herramientas principales:

1. Pulgadas a milimetros / Inches to millimeters.
2. Litros a galones (US/UK) / Liters to gallons (US/UK).
3. Metros cubicos / Cubic meters.

Objetivos no funcionales:

1. SEO internacional limpio desde el inicio.
2. UX clara en desktop y mobile.
3. Escalabilidad de contenido (nuevas landings, nuevos idiomas).
4. Compatibilidad con Cloudflare Pages + Functions.

---

## 2) Stack y runtime

## 2.1 Dependencias principales

Archivo: `package.json`

- `astro` `^5.5.5`
- `typescript` `^5.8.2`
- `@astrojs/check` `^0.9.6`

Scripts:

- `npm run dev` -> desarrollo local
- `npm run build` -> build estatico
- `npm run preview` -> preview local del build
- `npm run check` -> chequeo de tipos/diagnosticos Astro

## 2.2 Config Astro

Archivo: `astro.config.mjs`

- `site: "https://www.convertilab.com"`
- `trailingSlash: "always"`
- `build.format: "directory"`

Implicancia:

1. Todas las URLs deben contemplar slash final.
2. Canonicals/hreflang/sitemap se generan con slash final.

---

## 3) Estructura de carpetas (relevante)

```text
/
├─ src/
│  ├─ components/
│  │  ├─ Layout.astro
│  │  ├─ SEO.astro
│  │  ├─ Hero.astro
│  │  ├─ CalculatorCard.astro
│  │  ├─ AdSlot.astro
│  │  └─ calculators/
│  │     ├─ InchesCalculator.astro
│  │     ├─ LitersCalculator.astro
│  │     └─ CubicCalculator.astro
│  ├─ lib/
│  │  ├─ seo.ts
│  │  ├─ schema.ts
│  │  ├─ converters.ts
│  │  └─ i18n/
│  │     ├─ types.ts
│  │     ├─ routes.ts
│  │     └─ layout.ts
│  ├─ pages/
│  │  ├─ index.astro                (x-default language gateway)
│  │  ├─ sitemap.xml.ts             (sitemap dinamico)
│  │  ├─ es/
│  │  │  ├─ index.astro
│  │  │  ├─ pulgadas-a-milimetros.astro
│  │  │  ├─ litros-a-galones.astro
│  │  │  ├─ metros-cubicos.astro
│  │  │  ├─ sobre.astro
│  │  │  ├─ contacto.astro
│  │  │  ├─ privacidad.astro
│  │  │  └─ terminos.astro
│  │  └─ en/
│  │     ├─ index.astro
│  │     ├─ inches-to-millimeters.astro
│  │     ├─ liters-to-gallons.astro
│  │     ├─ cubic-meters.astro
│  │     ├─ about.astro
│  │     ├─ contact.astro
│  │     ├─ privacy-policy.astro
│  │     └─ terms.astro
│  ├─ styles/global.css
│  └─ env.d.ts
├─ public/
│  ├─ robots.txt
│  ├─ _redirects
│  └─ images/mobile-layout-preview.svg
├─ functions/
│  └─ api/locale.ts
├─ .env.example
├─ README.md
└─ documentacion.md
```

---

## 4) Arquitectura de rutas y mapeo i18n

Fuente de verdad: `src/lib/i18n/routes.ts`

`routeKey` soportados:

- `home`
- `inches`
- `liters`
- `cubic`
- `about`
- `contact`
- `privacy`
- `terms`

Matriz de rutas:

| routeKey | ES | EN | x-default |
|---|---|---|---|
| `home` | `/es/` | `/en/` | `/` |
| `inches` | `/es/pulgadas-a-milimetros/` | `/en/inches-to-millimeters/` | `/` |
| `liters` | `/es/litros-a-galones/` | `/en/liters-to-gallons/` | `/` |
| `cubic` | `/es/metros-cubicos/` | `/en/cubic-meters/` | `/` |
| `about` | `/es/sobre/` | `/en/about/` | `/` |
| `contact` | `/es/contacto/` | `/en/contact/` | `/` |
| `privacy` | `/es/privacidad/` | `/en/privacy-policy/` | `/` |
| `terms` | `/es/terminos/` | `/en/terms/` | `/` |

Regla de implementacion:

1. Cada pagina localizada pasa a `Layout`:
   - `locale`
   - `routeKey`
   - `alternateUrls={getAlternateUrls(routeKey)}`

2. `getAlternateUrls(routeKey)` siempre retorna:
   - locale ES
   - locale EN
   - `x-default` a `/`

---

## 5) Flujo i18n en runtime

## 5.1 Toggle de idioma en header

Archivo: `src/components/Layout.astro`

Comportamiento:

1. Renderiza toggle solo cuando la pagina tiene `locale`.
2. El enlace ES apunta al path ES equivalente.
3. El enlace EN apunta al path EN equivalente.
4. Al click:
   - guarda `preferredLocale` en `localStorage`
   - dispara evento `language_switch`

Fallback:

- Si falta alternate explicito, usa `getPath(locale, routeKey)` como respaldo.

## 5.2 Pagina raiz `/` como gateway neutral

Archivo: `src/pages/index.astro`

Comportamiento:

1. Muestra dos tarjetas: Espanol y English.
2. No redirige automaticamente.
3. Puede mostrar sugerencia no bloqueante:
   - "Suggested language: ..."
4. Usuario puede:
   - aceptar `Switch`
   - `Stay here`

Persistencia:

- Eleccion manual guarda `preferredLocale`.
- Si `preferredLocale` coincide con sugerencia, la sugerencia no se muestra.

## 5.3 Sugerencia de idioma (fuentes de senal)

Implementada en `src/pages/index.astro`:

1. Navegador:
   - `navigator.languages` o `navigator.language`
   - si comienza por `es`, senal ES positiva.
2. Geografia:
   - fetch a `/api/locale`
   - usa `country` y lista de mercados hispanos

Decision actual:

- Si browser es ES o country es mercado hispano -> sugerir ES.
- Si no -> sugerir EN.

`source_signal` emitido:

- `both`
- `browser`
- `country`

Nota:

- La lista de paises hispanos esta duplicada en:
  - `src/pages/index.astro`
  - `functions/api/locale.ts`
- Si se cambia una, se debe cambiar la otra para evitar divergencia.

---

## 6) API de geolocalizacion (Cloudflare)

Archivo: `functions/api/locale.ts`

Ruta:

- `GET /api/locale`

Entrada:

- Sin body
- Lee cabeceras/metadata de Cloudflare:
  - `CF-IPCountry`
  - `request.cf.country`

Salida JSON:

```json
{
  "country": "UY",
  "suggestedLocale": "es"
}
```

Contrato:

- `country`: `string | null`
- `suggestedLocale`: `"es" | "en"`

Cache:

- `cache-control: public, max-age=300`

Fallback:

- Si no hay country valido (`null`), sugiere EN.

---

## 7) SEO tecnico internacional

## 7.1 Componente SEO

Archivo: `src/components/SEO.astro`

Incluye:

1. `<title>`
2. `meta description`
3. `meta robots`
4. `meta keywords` opcional
5. `<link rel="canonical">` opcional
6. OG tags y Twitter tags
7. `og:locale` por idioma
8. `link rel="alternate" hreflang=...` para cada alternate
9. JSON-LD (`application/ld+json`) por pagina

## 7.2 Canonical y hreflang

Regla aplicada:

1. Canonical siempre auto-referencial en URL localizada.
2. Hreflang incluye:
   - `es`
   - `en`
   - `x-default` (`/`)

## 7.3 JSON-LD

Helper: `src/lib/schema.ts`

Tipos soportados:

1. `WebSite`
2. `WebPage`
3. `SoftwareApplication`
4. `BreadcrumbList`

Internacionalizacion:

- `inLanguage` segun locale (`es` o `en`).

## 7.4 Sitemap

Archivo: `src/pages/sitemap.xml.ts`

Caracteristicas:

1. Genera URLs ES + EN para todos los `routeKey`.
2. Incluye `xhtml:link` alternates (`es`, `en`, `x-default`).
3. Incluye `changefreq` y `priority` por routeKey.
4. Incluye raiz `/` como entrada `x-default`.

## 7.5 Robots

Archivo: `public/robots.txt`

Contiene:

- `Allow: /`
- referencia a `https://www.convertilab.com/sitemap.xml`

---

## 8) Redirecciones legacy (SEO migration)

Archivo: `public/_redirects`

Objetivo:

- Mantener autoridad y enlaces historicos desde URLs antiguas en raiz ES.

Reglas:

- `/pulgadas-a-milimetros` -> `/es/pulgadas-a-milimetros/` (301)
- `/litros-a-galones` -> `/es/litros-a-galones/` (301)
- `/metros-cubicos` -> `/es/metros-cubicos/` (301)
- `/sobre` -> `/es/sobre/` (301)
- `/contacto` -> `/es/contacto/` (301)
- `/privacidad` -> `/es/privacidad/` (301)
- `/terminos` -> `/es/terminos/` (301)

Incluye variantes con y sin slash.

---

## 9) Arquitectura de componentes

## 9.1 Layout global

Archivo: `src/components/Layout.astro`

Responsabilidades:

1. Cargar estilos globales.
2. Renderizar header/nav/footer.
3. Inyectar `SEO`.
4. Inyectar scripts de:
   - AdSense
   - GA4
   - Cloudflare Analytics
5. Exponer `window.trackEvent`.
6. Manejar tracking de:
   - `language_switch`
   - `ad_click_outbound`

Props publicas:

- `locale?: "es" | "en"`
- `routeKey?: RouteKey`
- `alternateUrls?: AlternateUrl[]`
- `title?: string`
- `description?: string`
- `canonicalPath?: string`
- `keywords?: string`
- `noindex?: boolean`
- `structuredData?: Array<Record<string, unknown>>`

## 9.2 Hero

Archivo: `src/components/Hero.astro`

Props:

- `title`
- `subtitle`
- `primaryCta?`
- `secondaryCta?`

Nota actual:

- El kicker (`"Conversiones exactas para industria, obra y logistica"`) esta hardcodeado en espanol incluso en paginas EN.

## 9.3 CalculatorCard

Archivo: `src/components/CalculatorCard.astro`

Uso:

- Cards de navegacion entre herramientas.

## 9.4 AdSlot

Archivo: `src/components/AdSlot.astro`

Props:

- `slotName`
- `note?`
- `variant?: "horizontal" | "vertical"`

Resolucion de slot env:

- construye `PUBLIC_ADSENSE_SLOT_${slotName.toUpperCase()}`

Comportamiento:

1. Si `PUBLIC_ADSENSE_CLIENT_ID` + slot especifico existen:
   - renderiza `<ins class="adsbygoogle">` y push.
2. Si faltan:
   - renderiza placeholder textual con nota.

---

## 10) Calculadoras compartidas (JS vanilla)

Objetivo:

- Evitar duplicacion entre ES y EN.

## 10.1 InchesCalculator

Archivo: `src/components/calculators/InchesCalculator.astro`

Funcionalidad:

1. Acepta decimal y fracciones:
   - `1/4`
   - `1 1/2`
   - `1-1/2`
2. Convierte con factor `25.4`.
3. Permite copiar resultado.
4. Emite eventos:
   - `convert_inches_mm`
   - `copy_result`

## 10.2 LitersCalculator

Archivo: `src/components/calculators/LitersCalculator.astro`

Funcionalidad:

1. Selector de tipo de galon (`us`/`uk`).
2. Factores:
   - US: `3.785411784`
   - UK: `4.54609`
3. Permite copiar resultado.
4. Emite:
   - `convert_liters_gallons`
   - `copy_result`

## 10.3 CubicCalculator

Archivo: `src/components/calculators/CubicCalculator.astro`

Funcionalidad:

1. Entradas largo/ancho/alto.
2. Unidad `m` o `cm`.
3. Si `cm`, aplica factor `0.01` para normalizar a metros.
4. Calcula `m3 = l * w * h`.
5. Permite copiar resultado.
6. Emite:
   - `calculate_cubic_meters`
   - `copy_result`

## 10.4 Biblioteca numerica auxiliar

Archivo: `src/lib/converters.ts`

Contiene funciones puras equivalentes para conversiones. Actualmente no es la fuente activa de calculo en UI (las formulas se ejecutan en scripts inline de componentes de calculadora), pero sirve como referencia reutilizable futura.

---

## 11) Inventario de paginas

## 11.1 Root neutral

- `/` -> selector de idioma + banner de sugerencia.

## 11.2 Arbol ES

- `/es/` -> home/hub ES con 3 calculadoras + ads laterales/middle.
- `/es/pulgadas-a-milimetros/` -> landing tool + ad top/bottom.
- `/es/litros-a-galones/` -> landing tool + ad top/bottom.
- `/es/metros-cubicos/` -> landing tool + ad top/bottom.
- `/es/sobre/` -> about.
- `/es/contacto/` -> contact.
- `/es/privacidad/` -> privacy.
- `/es/terminos/` -> terms.

## 11.3 Arbol EN

- `/en/` -> home/hub EN con 3 calculadoras + ads laterales/middle.
- `/en/inches-to-millimeters/` -> landing tool + ad top/bottom.
- `/en/liters-to-gallons/` -> landing tool + ad top/bottom.
- `/en/cubic-meters/` -> landing tool + ad top/bottom.
- `/en/about/` -> about.
- `/en/contact/` -> contact.
- `/en/privacy-policy/` -> privacy.
- `/en/terms/` -> terms.

---

## 12) Slots publicitarios y variables

Variables en `.env.example`:

- `PUBLIC_ADSENSE_CLIENT_ID`
- `PUBLIC_ADSENSE_SLOT_HOME_LEFT`
- `PUBLIC_ADSENSE_SLOT_HOME_MIDDLE`
- `PUBLIC_ADSENSE_SLOT_HOME_RIGHT`
- `PUBLIC_ADSENSE_SLOT_INCHES_TOP`
- `PUBLIC_ADSENSE_SLOT_INCHES_BOTTOM`
- `PUBLIC_ADSENSE_SLOT_LITERS_TOP`
- `PUBLIC_ADSENSE_SLOT_LITERS_BOTTOM`
- `PUBLIC_ADSENSE_SLOT_CUBIC_TOP`
- `PUBLIC_ADSENSE_SLOT_CUBIC_BOTTOM`

Matriz de uso:

| Slot | Usado en |
|---|---|
| `home_left` | `/es/`, `/en/` |
| `home_middle` | `/es/`, `/en/` |
| `home_right` | `/es/`, `/en/` |
| `inches_top` | landings inches ES/EN |
| `inches_bottom` | landings inches ES/EN |
| `liters_top` | landings liters ES/EN |
| `liters_bottom` | landings liters ES/EN |
| `cubic_top` | landings cubic ES/EN |
| `cubic_bottom` | landings cubic ES/EN |

---

## 13) Analitica y eventos

## 13.1 Proveedores

- GA4 (si `PUBLIC_GA4_ID` existe).
- Cloudflare Web Analytics (si `PUBLIC_CF_WEB_ANALYTICS_TOKEN` existe).

## 13.2 API de tracking interna

`window.trackEvent(eventName, params?)` definida en `Layout`.

## 13.3 Eventos emitidos

| Evento | Trigger | Payload principal |
|---|---|---|
| `convert_inches_mm` | submit inches | `value`, `source` |
| `convert_liters_gallons` | submit liters | `liters`, `gallon_type`, `source` |
| `calculate_cubic_meters` | submit cubic | `length`, `width`, `height`, `input_unit`, `source` |
| `copy_result` | click copy | `tool` |
| `language_switch` | toggle ES/EN o eleccion directa en `/` | `from_locale`, `to_locale` |
| `language_suggestion_shown` | sugerencia visible en `/` | `suggested_locale`, `source_signal`, `country` |
| `language_suggestion_accept` | click switch sugerido | `suggested_locale`, `source_signal` |
| `language_suggestion_dismiss` | click stay | `{}` |
| `ad_click_outbound` | click link con `data-ad-outbound="true"` | `href`, `placement` |

Nota:

- Actualmente no hay enlaces de salida con `data-ad-outbound="true"` en las paginas base; el hook esta preparado para cuando se agreguen.

---

## 14) Sistema de estilos y breakpoints

Archivo: `src/styles/global.css`

Puntos clave:

1. Variables de tema en `:root`.
2. Header sticky.
3. Toggle de idioma con `.lang-toggle` y `.lang-pill`.
4. Layout home:
   - mobile: flujo vertical
   - desktop (`min-width: 1200px`): grid 3 columnas (`left rail`, `content`, `right rail`)
5. Ads:
   - `.ad-slot` horizontal base
   - `.ad-slot--vertical` para rails laterales
6. Breakpoints:
   - `720px`: grillas de formularios/cards
   - `980px`: spacing/padding panel
   - `1200px`: rails laterales sticky y ocultar mock mobile

---

## 15) Configuracion de entorno

Archivo: `.env.example`

Variables:

1. `PUBLIC_GA4_ID`
2. `PUBLIC_CF_WEB_ANALYTICS_TOKEN`
3. `PUBLIC_ADSENSE_CLIENT_ID`
4. Slots `PUBLIC_ADSENSE_SLOT_*`

Regla:

- Toda variable `PUBLIC_*` queda expuesta al cliente (no usar secretos sensibles aqui).

---

## 16) Build, validacion y ejecucion

Comandos:

```bash
npm install
npm run check
npm run build
npm run dev
```

Salida esperada:

- `check`: 0 errors, 0 warnings, 0 hints.
- `build`: genera `dist/` con rutas ES/EN, `sitemap.xml`, `robots.txt`, `_redirects`.

---

## 17) Contratos e invariantes (muy importante para agentes IA)

1. Cada pagina localizada debe declarar `routeKey` valido.
2. Cada pagina localizada debe pasar `alternateUrls={getAlternateUrls(routeKey)}` a `Layout`.
3. No eliminar `x-default` de alternates.
4. Canonical de pagina localizada debe apuntar a su propia URL, no a `/`.
5. Si se agrega o cambia `routeKey`, se deben actualizar:
   - `src/lib/i18n/types.ts`
   - `src/lib/i18n/routes.ts`
   - `src/lib/i18n/layout.ts` (labels nav/legal)
   - paginas ES/EN correspondientes
   - sitemap (automatico si `routePaths` se actualiza)
6. Si se cambia lista de paises hispanos, actualizar:
   - `src/pages/index.astro`
   - `functions/api/locale.ts`
7. Mantener redirecciones legacy en `public/_redirects` para no perder SEO historico.
8. Mantener `trailingSlash: "always"` consistente con enlaces/canonical.
9. No pegar ads a controles de calculadora.
10. No romper ids unicos en componentes de calculadora (`idPrefix` obligatorio).

---

## 18) Playbooks de mantenimiento

## 18.1 Agregar una nueva herramienta bilingue

Pasos:

1. Crear nuevo `routeKey` en `src/lib/i18n/types.ts`.
2. Agregar paths ES/EN en `src/lib/i18n/routes.ts`.
3. Agregar labels nav/legal en `src/lib/i18n/layout.ts` si corresponde.
4. Crear `src/pages/es/<slug-es>.astro`.
5. Crear `src/pages/en/<slug-en>.astro`.
6. Usar componentes compartidos de calculadora o crear uno nuevo en `src/components/calculators/`.
7. Agregar JSON-LD:
   - `createWebPageSchema`
   - `createSoftwareApplicationSchema` (si es herramienta)
   - `createBreadcrumbSchema`
8. Definir canonical local en cada idioma.
9. Ejecutar `npm run check` y `npm run build`.

## 18.2 Agregar un nuevo idioma (ej. pt)

Estado actual: no soportado por tipos.

Pasos minimos:

1. Extender `Locale` en `src/lib/i18n/types.ts`.
2. Extender `routePaths` para nuevo locale.
3. Extender `layoutStrings`.
4. Adaptar `Layout` toggle (de 2 idiomas a n idiomas).
5. Ajustar `alternateUrls` para incluir nuevo locale.
6. Ajustar `sitemap.xml.ts` para iterar locales dinamicos.
7. Ajustar schema `localeToLanguageTag`.

## 18.3 Agregar evento de analitica

1. Emitir `window.trackEvent("nuevo_evento", payload)` en punto de accion.
2. Mantener payload plano y estable (snake_case recomendado).
3. Documentar en esta guia (seccion Eventos).

---

## 19) Riesgos, limites y deuda tecnica actual

1. `Hero.astro` tiene kicker fijo en espanol para ambos idiomas.
2. La lista de paises hispanos esta duplicada en frontend y function.
3. `src/lib/converters.ts` no es fuente activa de UI (posible drift si no se sincroniza).
4. `functions/api/locale.ts` usa `any` para contexto (pragmatico, no tipado estricto Pages Function).
5. Root `/` muestra textos mezclados ES/EN de forma intencional; si se busca UX mas limpia se puede separar por bloques mas claros.
6. `ad_click_outbound` requiere atributo `data-ad-outbound="true"` en enlaces para activarse.

---

## 20) Guia de troubleshooting

## 20.1 No aparece sugerencia de idioma

Checklist:

1. Verificar que `/api/locale` responda 200 en Cloudflare Pages.
2. Verificar consola por error de fetch.
3. Confirmar si `preferredLocale` ya existe y coincide.
4. Revisar que el bloque `#locale-suggestion` no este oculto por CSS personalizado.

## 20.2 Toggle no cambia de pagina equivalente

Checklist:

1. Verificar `routeKey` correcto en la pagina.
2. Verificar `alternateUrls={getAlternateUrls(routeKey)}`.
3. Verificar `routePaths` con slug correcto ES/EN.

## 20.3 Hreflang incorrecto en una pagina

Checklist:

1. Verificar props `alternateUrls` en `Layout`.
2. Verificar `getAlternateUrls(routeKey)`.
3. Inspeccionar HTML generado (`<link rel="alternate" ...>`).

## 20.4 Ads no cargan

Checklist:

1. `PUBLIC_ADSENSE_CLIENT_ID` definido.
2. `PUBLIC_ADSENSE_SLOT_<NOMBRE>` definido para cada slot usado.
3. No bloqueadores activos en navegador.
4. Revisar placeholder: si aparece, faltan variables.

---

## 21) Referencia rapida de archivos clave

- Layout global: `src/components/Layout.astro`
- SEO head: `src/components/SEO.astro`
- Mapa i18n rutas: `src/lib/i18n/routes.ts`
- Strings layout i18n: `src/lib/i18n/layout.ts`
- Tipos i18n: `src/lib/i18n/types.ts`
- Schemas SEO: `src/lib/schema.ts`
- Root gateway: `src/pages/index.astro`
- Home ES: `src/pages/es/index.astro`
- Home EN: `src/pages/en/index.astro`
- Sugerencia locale API: `functions/api/locale.ts`
- Sitemap dinamico: `src/pages/sitemap.xml.ts`
- Redirects legacy: `public/_redirects`
- Variables env ejemplo: `.env.example`

---

## 22) Reglas de trabajo recomendadas para agentes IA

1. Antes de editar, leer:
   - `src/lib/i18n/types.ts`
   - `src/lib/i18n/routes.ts`
   - `src/components/Layout.astro`
2. No crear rutas nuevas fuera de `routePaths` sin justificar.
3. Cualquier pagina localizada nueva debe tener su par ES/EN.
4. Si se toca SEO, validar:
   - canonical
   - hreflang
   - structured data
   - sitemap
5. Ejecutar siempre:
   - `npm run check`
   - `npm run build`
6. Actualizar `documentacion.md` si cambia contrato publico o flujo principal.

---

## 23) Estado del proyecto al momento de esta documentacion

- Arquitectura bilingue ES/EN activa.
- Rutas legacy redirigidas a ES.
- SEO internacional operativo.
- Build y checks verdes.
- Preparado para despliegue en Cloudflare Pages + Cloudflare Registrar.
