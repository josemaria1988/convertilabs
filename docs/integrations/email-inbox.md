# Facturas recibidas por Gmail en la PC de Rontil

La recepción local importa adjuntos de facturas a Convertilabs. No envía correos, no modifica mensajes en Gmail y no registra automáticamente comprobantes en Zeta. La revisión humana, la copia mensual y el preflight de Zeta siguen siendo obligatorios.

## Configuración privada

Crear `.env.email.local` en la raíz del proyecto, con acceso restringido al usuario de Windows. Está excluido de Git y se carga separado del resto de las credenciales:

```dotenv
CONVERTILABS_EMAIL_ENABLED=true
CONVERTILABS_EMAIL_ADDRESS=efacturarontil@gmail.com
CONVERTILABS_EMAIL_APP_PASSWORD=
CONVERTILABS_EMAIL_MAILBOX=INBOX
CONVERTILABS_EMAIL_SINCE=2026-09-11
```

Ingresar la contraseña de aplicación de Google directamente en ese archivo. Nunca enviarla al chat, incluirla en argumentos de comandos, capturas o registros. Google requiere verificación en dos pasos para crear estas contraseñas. Una contraseña normal de la cuenta no sustituye la contraseña de aplicación. Algunas políticas de Google pueden impedir generarla. [Ayuda oficial de Google](https://support.google.com/mail/answer/185833?hl=es).

El lector admite Gmail personal mediante `imap.gmail.com:993` con TLS y validación de certificado. El archivo separado admite sólo las cinco claves anteriores; no modifica `process.env` ni propaga el secreto a Next o Codex. El entorno de extracción de Codex también tiene una lista explícita de variables permitidas que excluye las credenciales de correo.

Configuración incompleta devuelve `pending_configuration` y permite que continúe el procesamiento de facturas cargadas desde el teléfono. El archivo se vuelve a leer en cada ciclo. Configurar la dirección o generar un alias de reenvío en la web no prueba que exista una conexión al correo.

## Prueba y ejecución

Desde la raíz del proyecto:

```powershell
npm run local -- email-inbox --dry-run
npm run local -- email-inbox --once
```

`--dry-run` comprueba la configuración sin red ni escrituras en Supabase. `--once` conecta a Gmail y recibe adjuntos una vez usando la organización y el actor ya configurados para el acompañante local. Es una consulta manual explícita que puede adelantar la próxima revisión del correo. No inicia otro trabajador ni extrae imágenes por sí solo.

El trabajador oficial invoca la recepción antes de revisar su cola, una vez cada cuatro horas. No existe un modelo conectado mientras el buzón está quieto. Los XML CFE siguen el procesamiento determinista y las representaciones visuales admitidas usan la cola existente de `codex_local`, con API paga deshabilitada. El trabajador conserva su límite actual de una extracción visual por ciclo; si llegan varias imágenes o PDF, los restantes quedan en cola. Para urgencias puede procesarse un pendiente con `worker --once`, que también revisa el correo. No iniciar trabajadores paralelos innecesarios.

La PC y el trabajador deben estar activos. Cerrar Convertilabs local suspende las próximas recepciones. Reiniciar el trabajador no vuelve a consultar Gmail si su último `checkedAt` tiene menos de cuatro horas; devuelve `skipped_recently_checked`. La sincronización diaria de Zeta a las 18:00 es independiente y mantiene su presupuesto.

## Alcance de lectura y adjuntos

Se abre únicamente INBOX en modo de lectura. Gmail busca correos con adjuntos y asunto de factura/CFE/comprobante o un adjunto XML, desde `CONVERTILABS_EMAIL_SINCE`. No se descarga todo el historial ni se usan las consultas del asistente para leer correspondencia general. Se solicitan los identificadores, el sobre y la estructura MIME del mensaje candidato; se descargan sólo las partes adjuntas seleccionadas mediante `BODY.PEEK`/`BINARY.PEEK` de ImapFlow. No se descargan cuerpos de texto/HTML para analizarlos con IA. [API de ImapFlow](https://imapflow.com/docs/api/imapflow-client/).

Se reconocen PDF, XML, JPG y PNG por adjunto; el tipo `application/octet-stream` no excluye un nombre terminado en `.xml`. La ingesta valida luego los bytes y la estructura real. Se excluyen rebotes de entrega, iconos y firmas. Las imágenes adjuntas deben tener al menos 20 KB y no tener nombre de icono/firma. Si una foto relevante acompaña un XML/PDF, se conserva y queda pendiente de identificar si es respaldo o una factura diferente; el XML/PDF puede avanzar sin convertir esa foto automáticamente en otro comprobante.

Cada adjunto está limitado a 20 MB y cada correo a 50 MB descargados; un ciclo atiende hasta 20 mensajes candidatos. No se extraen ZIP automáticamente: se conserva el original privado y queda pendiente de revisión. XML inválidos, documentos de otro receptor o formatos sin soporte también deben permanecer como pendientes explícitos. Los resultados no deben presentarse como facturas registradas en Zeta.

Para los CFE bancarios con `SecProf=1`, el receptor puede venir en un único bloque `SecretoProfesional` dentro del texto de la `Adenda` del mismo `CFE_Adenda`. Se admite sólo cuando tipo de CFE, serie y número coinciden exactamente, el receptor identifica un RUT uruguayo de la organización y no hay campos duplicados, estructuras ambiguas ni conflicto con el receptor de cabecera. La carátula, el correo y las adendas de otros CFE nunca suplen al receptor. Se conserva el origen `Adenda/SecretoProfesional/Receptor`, la identidad fiscal vinculada y `signatureVerified: false` en la evidencia del borrador; la firma no se consulta ni se valida y la revisión humana continúa pendiente.

## Duplicación, recuperación y estado

La carpeta `.local-companion/email/` guarda originales, el estado resumido y un checkpoint separado por organización, cuenta e INBOX. El checkpoint identifica la generación del buzón (`UIDVALIDITY`) y cada mensaje (`UID`). Se avanza únicamente después de persistir los documentos o un registro de cuarentena independiente. Si falla una ingesta después de guardar algunos documentos, su reintento reutiliza las identidades y hashes compartidos.

Los pendientes conservan UID, generación, motivo, nombres y respaldo local. Un ZIP o una decisión de revisión no bloquea los correos siguientes ni se vuelve a descargar cada cuatro horas. Los errores operativos conservan una lista de reintentos para el siguiente ciclo. Una generación nueva de Gmail vuelve a buscar desde la fecha autorizada y mantiene la evidencia pendiente de la generación anterior.

Los originales ya cargados desde otra superficie se reutilizan por hash; el procesador de CFE aplica también la identidad fiscal. El candado del lector evita dos recepciones simultáneas en una PC; no es una exclusión global entre computadoras. La protección final de documentos corresponde a las identidades compartidas en Supabase.

Un cierre abrupto puede dejar `poll.lock`. El lector no roba esa reserva automáticamente: un operador debe verificar que su PID no siga activo antes de retirarla. No borrar `state.json` ni los adjuntos para solucionar un error: perdería trazabilidad o provocaría una lectura histórica repetida. Para un pendiente de revisión, trabajar sobre el original guardado y el documento de Convertilabs; si se necesita repetir la ingesta de un mensaje en cuarentena después de corregir el soporte, conservar primero su evidencia y autorizar una recuperación puntual del UID.

Una recuperación puntual puede invocar `ingestEmailAttachments` de `modules/local-companion/email-documents.ts` con sólo los adjuntos locales autorizados, sus hashes y el `metadata_json.source` del original ya conservado en `integration_raw_records` (`provider=email_inbox`, `entity_type=email_attachment`, organización y hash exactos). Verificar antes UID, UIDVALIDITY y hash; detenerse si falta esa procedencia. Este servicio conserva deduplicación y referencias al correo sin abrir Gmail ni modificar el checkpoint. No sustituirlo por una nueva carga visual ni por una recepción general del buzón.

Los estados `configured`, `received`, `pending_review`, `pending_configuration` y `error` distinguen preparación, conexión/recepción, documentos pendientes y fallos. Nunca registrar ni mostrar la contraseña, respuestas IMAP crudas o cuerpos completos de correo.

Después de abrir INBOX correctamente se registra una observación segura de conexión en la configuración compartida de correo. La fecha de última recepción se actualiza sólo después de una ingesta durable. El resultado `cloudObservation` permite detectar si falló guardar esa observación; un fallo de ese registro no cancela documentos ya recibidos. La pantalla web muestra fechas de observación, no una garantía de que la PC siga encendida en ese instante.

## Facturas de proveedores en Inicio

Inicio muestra un tablero por proveedor que incluye las facturas recibidas en Convertilabs por correo, foto u otros canales. Permite buscar por nombre o RUT y abrir el documento para revisarlo. Los vencimientos faltantes se muestran como tales y los importes se mantienen separados por moneda.

El tablero distingue saldos pendientes confirmados de facturas cuyo pago todavía requiere confirmación. Recibir un CFE, que diga contado o que esté registrado en Zeta no prueba por sí solo que esté pagado. Un comprobante de cobranza, una nota de crédito o un movimiento de tarjeta no se convierten automáticamente en otra deuda a proveedor. La foto y el XML de una misma factura deben contar una sola vez.

Las instrucciones revisadas por el usuario se conservan por comprobante en su contexto contable y en `documents.metadata.administrative_review`, vinculadas a organización, borrador, identidad fiscal y hash/fila de la planilla. El tablero separa “Pagadas según tu revisión” y “Pendientes según tu revisión”, y muestra cualquier saldo observado con fuente y fecha. Una declaración no crea un asiento, recibo o pago en Zeta; las fechas e importes de pago no informados permanecen vacíos. Si cambia el comprobante, hay fuentes discordantes o un saldo posterior contradice la declaración, queda para revisar. No se crean reglas futuras sin un alcance confirmado.

El origen de lectura es Supabase: documentos y borradores, partidas abiertas y evidencia de pago ya conservada. Abrir Inicio no conecta a Gmail ni consulta la API de Zeta. La recepción conserva su intervalo de cuatro horas y Zeta su sincronización diaria. El tablero informa la cobertura disponible y cualquier lectura incompleta; no representa por sí solo todas las deudas del ERP ni genera pagos, asientos o envíos automáticos.
