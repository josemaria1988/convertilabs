# Primera factura de gasto: foto a ZetaSoftware

Estado: piloto controlado para Rontil S.A.
Ultima revision: 2026-08-20.

## Objetivo

Registrar una factura real de compra/gasto con el menor trabajo manual posible:

```text
telefono -> foto privada -> extraccion -> confirmacion -> dry-run -> alta unica en Zeta -> verificacion
```

El piloto no cubre mercaderia/stock, proveedores nuevos ni adjuntos dentro de Zeta. La foto original queda privada y trazable en Convertilabs.

## Preparacion, una sola vez

1. Abrir `Ajustes -> Integraciones -> Zetasoftware`.
2. Probar la conexion real.
3. Ejecutar `Sincronizar maestros`.
4. En `Salida de facturas de gasto`, seleccionar los codigos reales:
   - compra credito de gastos: `26 - Compra Credito Gastos`;
   - compra contado de gastos: `28 - Compra Contado Gastos`;
   - nota de credito de gastos: `27 - Nota de Credito Gastos`;
   - concepto fallback: opcional y solo como referencia para el dry-run;
   - condiciones de credito y contado;
   - forma de pago efectivo y, solo si se usaran, transferencia/tarjeta/cheque;
   - moneda: `1 - UYU`;
   - local: `1 - Casa Central`;
   - usuario operativo: elegir el usuario que deba figurar en Zeta;
   - caja operativa: elegir una caja activa del local 1.
5. Guardar con `Habilitar escritura real` apagado.

No usar automaticamente `Gastos Varios`: cada factura real exige seleccionar y confirmar su concepto Zeta exacto en la pantalla del documento.

## Factura recomendada para la primera prueba

- Proveedor que ya exista en Zeta y tenga RUT correcto.
- Factura de gasto, no mercaderia ni stock.
- UYU.
- Una sola tasa de IVA y totales claramente legibles.
- Sin notas de credito, moneda extranjera, lotes ni distribuciones especiales.
- Preferentemente contado y con una sola forma de pago.

## Ejecucion desde el telefono

1. Abrir `/mobile` e ingresar a Rontil S.A.
2. Pulsar `Sacar foto de factura`.
3. Fotografiar el comprobante completo, sin sombras y con RUT, serie, numero, fecha y totales visibles.
4. Esperar la extraccion automatica. La aplicacion abre directamente la confirmacion.
5. Comparar con el original y corregir:
   - proveedor y RUT;
   - serie y numero;
   - fecha;
   - moneda;
   - subtotal, IVA y total;
   - concepto Zeta de esta factura;
   - tipo de compra;
   - contado/credito, codigo exacto de condicion Zeta y forma de pago.
6. Pulsar `Confirmar datos y continuar`.
7. Pulsar `Validar para Zeta`. Esto no escribe en Zeta.
8. Si no hay bloqueos, volver a Ajustes y habilitar expresamente la escritura real.
9. Volver al documento y pulsar una sola vez `Enviar gasto a Zeta`.
10. Confirmar que el estado sea `Encontrado en Zeta` y verificar visualmente la compra en ZetaSoftware.
11. Volver a apagar la escritura al terminar el primer piloto.

## Detenerse y no reenviar

Detener el piloto si ocurre cualquiera de estos casos:

- proveedor inexistente o mas de una coincidencia;
- diferencia entre neto + IVA y total;
- concepto o tasa de IVA dudosos;
- compra de mercaderia;
- respuesta `Timeout sin certeza`;
- estado `Enviado, verificando` que no se resuelve;
- la compra ya aparece en Zeta.

Ante timeout o respuesta ambigua, consultar primero Zeta. Nunca repetir el envio a ciegas.

Antes de llamar `Agregar`, Convertilabs crea una reserva durable por proveedor Zeta exacto y serie/numero normalizados. Fecha, moneda, importe y tipo interno no cambian esa identidad; la huella de contenido se conserva aparte para auditoria. Esa reserva no se borra automaticamente aunque falle una operacion local posterior o Zeta rechace expresamente el alta. Las reservas de versiones anteriores tambien se comprueban y una identidad antigua no verificable bloquea el envio. No eliminar la reserva para "probar de nuevo"; cualquier liberacion requiere revision manual auditada y verificacion previa en Zeta.

Para Rontil, conservar el trabajo/proyecto en Convertilabs sin enviar su codigo como centro de costos Zeta. Combustible/otros gastos pagados con tarjeta usan la forma confirmada `10 - Tarjeta Emitida`, sin exigir banco o titular. El aviso habitual de documentos de tarjeta pendientes se deja para la conciliacion posterior; no confundirlo con un rechazo de la API ni con una compra ya conciliada. El efectivo mantiene su forma de pago propia.

## Controles implementados

- escritura bloqueada en modo mock o `read_only`;
- proveedor existente obligatorio;
- comprobante de gasto activo;
- local, usuario y caja reales y sincronizados;
- condicion de pago Zeta confirmada por factura;
- fecha enviada como `AAAAMMDD`;
- limites oficiales de notas y concepto;
- preflight de duplicado por proveedor/comprobante/serie/numero;
- reserva durable y atomica por identidad fiscal estable antes de `Agregar`, con compatibilidad conservadora de reservas anteriores;
- una sola llamada de alta;
- validacion de `Response.Succeed`;
- consulta posterior `QueryCompras` para recuperar `RegistroId`;
- estado conservador sin reintento cuando el resultado es incierto.

## Alcance posterior

Mantener confirmacion humana hasta completar al menos 20 facturas consecutivas sin discrepancias de proveedor, identidad fiscal, IVA, moneda, concepto ni total. Para CFEs electronicos, el siguiente incremento recomendado es identificar la foto y recuperar el XML estructurado desde `CFEs recibidos`, dejando OCR como respaldo.

Fuentes oficiales:

- [Factura de proveedor: Agregar y QueryCompras](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-proveedores/)
- [CFEs recibidos](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/cfes-recibidos/)
- [Buenas practicas de APIs](https://zetasoftware.info/ayuda/apis/buenas-practicas/)
