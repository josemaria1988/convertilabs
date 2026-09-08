# Convertilabs: herramienta interna de Rontil

Leer `docs/agent_rules.md` y sus fuentes de arquitectura antes de modificar el sistema. La entrada publica es unicamente el login. Conservar la captura movil, Supabase compartido y la revision humana previa a Zeta.

## Operar desde Codex

Guia y limites: `docs/integrations/local-companion.md`. Ejecutar los comandos desde la raiz del proyecto; no imprimir claves ni credenciales. La configuracion privada esta en `.env.local` y `.local-companion/config.json`.

- Diagnostico sin escrituras: `npm run local -- doctor --cloud`.
- Cuando el usuario adjunte una factura y pida cargarla, usar `npm run local -- ingest --file '<ruta absoluta>'`. Esto conserva el original y crea una entrada en Supabase; no envia nada al ERP.
- Consultar `npm run local -- status --document <id>`. Si el trabajador no esta iniciado, `npm run local -- worker --once` procesa como maximo un pendiente de la organizacion. No iniciar trabajadores adicionales innecesarios.
- Devolver el estado real, las diferencias o datos faltantes y el enlace de revision. Un borrador extraido no equivale a una factura registrada en Zeta. No inventar RUT, codigos, cantidades ni importes.
- Reportes de lectura: `npm run local -- report sales --from YYYY-MM-DD --to YYYY-MM-DD --out '<archivo nuevo.json>'`; `report stock --out '<archivo nuevo.json>'`; `report base-prices --article '<codigo exacto>' --price-base '<codigo exacto>' --out '<archivo nuevo.json>'`.
- Guardar reportes y pruebas privadas bajo `.local-companion/`, que esta excluido de Git. Conservar ceros iniciales en los codigos de Zeta.

El procesamiento usa la sesion oficial de ChatGPT de esta PC. Nunca habilitar facturacion API como reemplazo automatico ante falta de cuota o sesion. La PC debe estar encendida y ejecutar el trabajador para consumir las fotos enviadas desde el celular.

Las solicitudes de cargar una factura o descargar un reporte autorizan esas operaciones concretas. El envio a Zeta requiere revision, preflight y confirmacion humana del comprobante. Las propuestas de cambios de stock o precios no autorizan aplicarlos al ERP.
