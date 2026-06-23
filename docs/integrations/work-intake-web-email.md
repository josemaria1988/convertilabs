# Work intake - web, API y email

## Estado

Documento de PR 8 y PR 9. Define como entran solicitudes comerciales sin crear ventas, documentos ni trabajos finales de forma automatica.

## Entidad canonica

La entrada operativa vive en `work_intake_items`.

Representa pedidos, cotizaciones, oportunidades, llamadas, WhatsApp, emails, formularios web o notas internas que todavia necesitan revision humana.

No reemplaza `work_unit`. Un intake puede derivar en trabajo, tarea, cotizacion o descarte.

## API web Rontil

Endpoint:

```text
POST /api/integrations/rontil-web/work-intake
```

Autenticacion:

- `Authorization: Bearer <token>`
- o `x-convertilabs-token: <token>`
- el token se valida contra `webhook_subscriptions.secret_hash`
- se aceptan hashes `sha256:<hex>` o `<hex>`

Evento permitido:

- `work_intake.created`
- `work_intake.received`
- `rontil_web.work_intake`
- `*`
- si `events` esta vacio, se acepta por compatibilidad inicial

Payload minimo:

```json
{
  "payload_version": "1",
  "quote_id": "WEB-123",
  "date": "2026-06-23",
  "customer": {
    "name": "Cliente Nueva Palmira",
    "email": "cliente@example.com",
    "phone": "099123456"
  },
  "text": "Solicitud de cotizacion para Nueva Palmira",
  "total": 12500,
  "currency": "UYU",
  "location": "Nueva Palmira",
  "source_url": "https://rontil.com/cotizaciones/WEB-123",
  "metadata": {}
}
```

Comportamiento:

- preserva raw en `integration_raw_records`;
- crea o reutiliza `work_intake_items`;
- usa `Idempotency-Key`, `idempotency_key` o `quote_id`;
- no crea venta;
- no crea documento;
- no crea `party` definitivo;
- no crea `work_unit` automaticamente;
- deja el intake en `needs_review`.

## Email

Estado inicial:

- sin conexion Gmail/email productiva en este PR;
- el dominio ya soporta `source_type = email`;
- `buildEmailWorkIntakeInput` normaliza raw email a intake revisable;
- la UI manual permite cargar origen `Email`.

Contrato esperado para integracion futura:

- `message_id` como idempotency key;
- asunto;
- remitente;
- destinatarios;
- fecha de recepcion;
- cuerpo raw;
- adjuntos como metadata;
- raw preservado en `integration_raw_records` o evidencia equivalente;
- opcionalmente crear `interaction` cuando el canal email quede conectado.

Regla:

La IA puede sugerir cliente, trabajo, monto, ubicacion, resumen y proxima accion. No puede crear venta final, marcar ganada, confirmar trabajo activo ambiguo ni inventar datos faltantes.

## Revision humana

Los estados operativos iniciales son:

- `captured`
- `needs_review`
- `linked_to_party`
- `linked_to_work`
- `converted_to_work`

Todo intake ambiguo debe quedar visible en Trabajos e Inicio hasta que alguien lo asocie, lo convierta o lo cierre.

## Verificacion

Tests relevantes:

```bash
node -e "require('./tests/register-ts.cjs'); require('./tests/work-intake.test.cjs'); require('./tests/work-intake-schema.test.cjs'); require('./tests/testkit.cjs').run()"
```

La suite completa tambien cubre el presenter de Inicio:

```bash
npm test
```
