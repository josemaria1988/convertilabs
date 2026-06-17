# PR-13 Hardening piloto interno

## Resultado

El repo queda preparado para uso interno diario con rutas, copy, checklist de piloto y comandos de calidad definidos.

## Rutas legacy

| Superficie | Decision |
|---|---|
| `/app/o/[slug]` | mantener como Inicio 2.0 |
| `/app/o/[slug]/work` | mantener |
| `/app/o/[slug]/documents` | mantener como Documentos |
| `/app/o/[slug]/money` | mantener |
| `/app/o/[slug]/agenda` | mantener |
| `/app/o/[slug]/continuity` | mantener |
| `/app/o/[slug]/directory` | mantener |
| `/review`, `/rules`, `/audit`, `/tax`, `/close` legacy top-level | mantener como redirects o accesos secundarios |
| Copy "beta privada" y "Bandeja Documental" visible | reemplazado en app/components |

## Superficies minimas

- Inicio
- Trabajos
- Detalle de trabajo
- Documentos
- Dinero
- Agenda
- Continuidad
- Directorio
- IVA/cierre

## Checklist Nueva Palmira

- Cliente Nueva Palmira creado como party.
- Trabajo Nueva Palmira creado como work_unit.
- Gasto vinculado al trabajo.
- Venta vinculada al trabajo.
- Margen visible en detalle de trabajo e Inicio.
- Open item a cobrar o pagar visible en Dinero.
- Tarea operativa visible en Agenda.
- IVA/cierre visible fuera de `/tax`.
- Historial de contacto vinculado a party y trabajo.

## Procesos reales iniciales

- Pago a proveedores.
- Preparacion IVA mensual.
- Enviar documentacion al contador.
- Control banco.
- Renovacion certificado DGI.
- Facturacion/cobro a cliente.

## Parties iniciales a cargar

- Contador.
- Banco principal.
- Principales clientes.
- Principales proveedores.
- Organismos relevantes.
- Contactos internos clave.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run db:verify:parity
npm run db:smoke:profile-sync
npm run db:smoke:organization-onboarding
npm run db:smoke:private-dashboard
npm run db:smoke:document-upload
```
