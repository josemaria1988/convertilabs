# Modulos

Cada carpeta aqui representa un dominio del sistema. La UI debe depender de estos
modulos y no al reves.

## Dominios con superficie activa hoy

- `auth`: login, signup, guards SSR y resolucion post-auth.
- `organizations`: onboarding, settings, feature flags y tenancy por organizacion.
- `documents`: upload, processing, review, posting y spreadsheets documentales.
- `assistant`: rail consultivo documental, threads, mensajes y sugerencias.
- `accounting`: kernel, reglas, learning, chart, read models, exports y open items.
- `tax`: IVA Uruguay, FX, conciliacion DGI y workbench fiscal.
- `close`: validator y lifecycle del periodo.
- `spreadsheets`, `imports`, `exports`, `audit`: carriles de soporte y bridge externo.
- `presentation`, `ui`, `explanations`: copy, labels, hints y contratos de explainability.

## Regla de mantenimiento

- si una feature nueva vive solo en UI, probablemente falte mover dominio a `modules/`;
- si cambia una responsabilidad de negocio, actualizar el README del modulo afectado;
- si el dominio ya tiene doc oficial en `docs/`, mantener ambos alineados.
