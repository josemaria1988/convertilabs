# Arquitectura inicial

## Decisiones

- Frontend y backend iniciales conviven dentro de Next.js.
- El App Router organiza marketing, app privada y endpoints internos.
- `modules/` marca fronteras de dominio para evitar mezclar reglas de negocio con UI.
- La base de datos puede arrancar en Supabase o Neon segun conveniencia operativa.
- El despliegue web objetivo es Vercel.

## Estructura del repo

```text
app/
  (marketing)/
  api/
  dashboard/
components/
lib/
modules/
styles/
docs/
```

## Siguiente capa tecnica

1. Resolver version de Node en el entorno local.
2. Elegir proveedor inicial entre Supabase o Neon.
3. Implementar auth y tenancy.
4. Conectar documents con almacenamiento y OCR.
5. Encender el flujo contable y fiscal sobre datos reales.
