# Convertilabs

Base inicial de producto en Next.js con App Router, TypeScript y Tailwind CSS.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- PostgreSQL como destino
- Supabase o Neon como punto de partida
- Vercel para deploy web

## Estructura

```text
convertilabs/
  app/
    (marketing)/
    dashboard/
    api/
  components/
  lib/
  modules/
    auth/
    organizations/
    documents/
    accounting/
    tax/
    ai/
  public/
  styles/
  docs/
```

## Rutas incluidas

Sitio publico:

- `/`
- `/product`
- `/api`
- `/pricing`
- `/about`
- `/contact`

App:

- `/login`
- `/dashboard`
- `/documents`
- `/journal-entries`
- `/tax`
- `/settings`

Endpoint tecnico:

- `/api/health`

## Desarrollo

```bash
npm run dev
```

## Nota de entorno

Durante la instalacion aparecieron warnings de engine para parte del toolchain con `Node 20.2.0`, pero en esta maquina `npm run typecheck`, `npm run build` y `npm run lint` pasaron correctamente. Aun asi, conviene subir Node cuando definamos baseline de equipo.
