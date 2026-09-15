# Avisos push de Agenda

Referencia técnica del dominio Agenda/Operaciones de Convertilabs 2.0. Describe la configuración y la comprobación de avisos en dispositivos; la existencia del código no acredita un despliegue ni una entrega real.

## Qué envía y cuándo

Vercel ejecuta `GET /api/cron/agenda-push` diariamente a las **12:00 UTC, 09:00 de America/Montevideo**, según `vercel.json`. Incluye sábados y domingos. Usa las tareas abiertas que vencen ese día y las ocurrencias de obligaciones elegibles que vencen dos días corridos después. Las tareas BROU que ya representan un aviso D-2 conservan su fecha de aviso: no se les restan otros dos días. Una tarea y su obligación para el mismo vencimiento generan un único evento.

La fuente es Supabase compartido. No consulta Zeta, no ejecuta pagos, renovaciones ni asientos y no depende de la PC, del trabajador local ni de Codex. El teléfono debe tener conectividad y permitir las notificaciones. El horario es el de la ejecución programada; no garantiza que el dispositivo muestre el aviso exactamente a esa hora.

## Configuración del servidor

Mantener estos valores en el entorno privado del despliegue, nunca en el repositorio ni en logs:

| Variable | Uso |
| --- | --- |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | Clave pública P-256 en base64url; la API la entrega al dispositivo autenticado. |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | Clave privada del mismo par; permanece exclusivamente en el servidor. |
| `WEB_PUSH_VAPID_SUBJECT` | Contacto del servicio en formato `mailto:` o URL HTTPS. |
| `CRON_SECRET` | Secreto de al menos 32 caracteres; el cron requiere `Authorization: Bearer …`. |

También se necesita la configuración Supabase existente del servidor, incluido su acceso de servicio. No crear una clave de servicio accesible desde el cliente. Conservar el mismo par VAPID entre despliegues; una rotación requiere planificar la renovación de las suscripciones existentes.

Antes de habilitarlo en producción:

1. Aplicar mediante el flujo de migraciones autorizado [20260915_agenda_web_push.sql](../../supabase/migrations/20260915_agenda_web_push.sql). Crea `web_push_subscriptions`, `web_push_deliveries`, funciones y políticas de acceso; el schema canónico está en [19_web_push.sql](../../db/schema/19_web_push.sql).
2. Configurar las cuatro variables y desplegar el código, el service worker y el cron en un entorno HTTPS con ejecución de cron habilitada.
3. Comprobar la activación y una prueba desde el dispositivo real. Separar resultado del servidor de recepción observada en el teléfono.

Las rutas `/api/v1/push` y `/api/v1/push/test` requieren sesión y membresía activa. Las mutaciones requieren origen propio. Un cron sin el secreto correcto responde 401. No invocar manualmente el cron como prueba inocua: puede enviar avisos reales de ese día.

## Activación y prueba en el dispositivo

1. Abrir **Agenda → Notificaciones en este dispositivo** dentro de la empresa correspondiente.
2. Pulsar **Activar avisos aquí** y aceptar el permiso del navegador/sistema. El permiso solo se solicita mediante ese gesto; no se concede desde el servidor ni desde otra PC.
3. Pulsar **Enviar prueba** y comprobar que aparezca en el dispositivo. Abrirla debe llevar a la Agenda de esa empresa.

En iPhone/iPad, primero agregar Convertilabs a la pantalla de inicio desde Compartir y abrirlo desde ese ícono; se requiere iOS/iPadOS 16.4 o posterior. Esa indicación no se muestra en Android. Un permiso bloqueado se corrige en los ajustes del navegador o de la app/sistema y luego se vuelve a comprobar el estado.

La activación es por usuario, empresa y dispositivo/navegador. Se conserva un identificador local; borrar datos del sitio o cambiar de navegador puede requerir activación nueva. Hay un máximo de diez dispositivos activos por usuario y empresa. Al activar el mismo navegador con otra cuenta, se deshabilitan las suscripciones anteriores de ese dispositivo para evitar avisos de la cuenta anterior.

**Enviar prueba** admite un intento por día, dispositivo y empresa. “Aceptada por el proveedor” no significa “recibida por el teléfono”. Una segunda solicitud no reenvía la prueba de ese día. No borrar registros para forzarla.

**Desactivar en este dispositivo** deshabilita los avisos de esa empresa para la cuenta actual. Conserva el permiso del navegador y las suscripciones de otras empresas; no marca tareas ni obligaciones como realizadas. Los avisos ya aceptados por un proveedor pueden estar en tránsito y no se pueden retirar.

El registro del service worker está deshabilitado en desarrollo local/localhost. Allí se verifican estados de UI y pruebas aisladas; la recepción real se prueba en el despliegue HTTPS.

## Duplicados, estados y límites

- Antes del envío se reserva un registro único por empresa, usuario, dispositivo y evento. La identidad del vencimiento incluye su fecha; una renovación confirmada con fecha nueva es otro evento. Varias ejecuciones del cron no vuelven a enviar el mismo evento a ese dispositivo.
- El registro se reserva **antes** del pedido HTTP. No se reintentan automáticamente respuestas fallidas ni resultados inciertos, incluidos timeouts. Esto reduce duplicados, pero puede dejar un aviso sin entrega si el proceso se interrumpe después de reservarlo. No es una garantía de entrega exactamente una vez.
- Se revalidan membresía, suscripción, fechas y estados antes de despachar. Actualizar el vencimiento exige conservar evidencia y mantener coherentes obligación, ocurrencia y tarea. Una fecha actual desconocida no debe convertirse en un aviso fechado por inferencia.
- El service worker muestra una notificación visible, evita repetir una etiqueta ya visible y abre únicamente Agenda del mismo origen. No almacena páginas ni respuestas privadas en caché.
- Cada dispositivo habilitado recibe su propio aviso. El proveedor puede conservarlo hasta doce horas; después puede descartarlo. Conectividad, permisos, ahorro de batería y preferencias del sistema afectan la entrega. Una corrida perdida no genera automáticamente un aviso atrasado al día siguiente.
- Las respuestas 404/410 del proveedor deshabilitan esa suscripción. Al pulsar Activar se reemplaza una suscripción vencida o ligada a una clave VAPID anterior; una suscripción válida se reutiliza. Si se reemplazó, revisar también la activación de otras empresas del mismo navegador. No se considera que el usuario pagó, canceló o renovó una obligación.

## Control operativo

Revisar los contadores del cron y `web_push_deliveries`: `claimed` es un intento reservado; `accepted`, aceptación del proveedor; `failed`, rechazo; `expired`, suscripción vencida; `unknown`, resultado no confirmado. Ninguno acredita lectura del usuario. Los errores registran códigos acotados, sin guardar el cuerpo privado del aviso ni claves o endpoints en el historial de entregas.

Si falta un aviso, comprobar en este orden: estado actual de la tarea/obligación y su fecha, activación del dispositivo, ejecución del cron, registro de entrega y permisos/conectividad del teléfono. No reabrir obligaciones, cambiar fechas ni borrar la reserva de envío solo para repetir una notificación.

Para evitar avisos por dos canales, revisar las automatizaciones anteriores de Codex cuando se complete la migración al canal push. El cron web no pausa por sí mismo esas automatizaciones.

Referencias de plataforma: [solicitud de permiso](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static) y [Web Push en iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
