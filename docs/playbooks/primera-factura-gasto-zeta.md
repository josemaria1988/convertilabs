# Primera factura de gasto: foto a ZetaSoftware

Estado: piloto controlado para Rontil S.A.
Ultima revision: 2026-09-11.

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

### Formato REST confirmado por soporte

La respuesta de soporte recibida el 2026-09-11 aclara que `RESTFacturaProveedorV1Agregar` requiere `Data.Movimiento` como objeto, aunque el ejemplo de Postman lo mostraba como array. Solo se quitan los corchetes de Movimiento; `Lineas` y `FormasPago` siguen siendo listas. El cliente hace esa conversion al construir el pedido HTTP y conserva sin cambios el payload interno revisado y las reservas. No acepta lotes de multiples movimientos por este camino.

Los tres comprobantes del piloto anterior ya se registraron desde la interfaz y se conciliaron con sus identificadores reales. La correccion no los vuelve a habilitar ni libera reservas. La siguiente validacion real necesita un documento nuevo revisado y autorizado; el resultado debe comprobarse en Zeta. La confirmacion del formato no resuelve por si sola la interpretacion del IVA indicada a continuacion.

### Precio digitado y tratamiento del IVA

El [maestro de proveedores de Zeta](https://zetasoftware.info/ayuda/configuracion/contactos/contactos-clientes-y-proveedores/exportar-e-importar-contactos-con-excel/) define `S/M` como IVA incluido (M permite modificarlo), `N/O` como no incluido (O permite modificarlo) y `E` como exento. El [contrato de compras](https://zetasoftware.info/ayuda/apis/indice-de-apis/gestion-y-contabilidad/facturas-de-proveedores/) indica que el calculo depende del proveedor, comprobante e IVA, pero no fija su precedencia cuando difieren.

Mientras esa semantica de `PrecioUnitario` REST no este confirmada, el resolver bloquea facturas con IVA distinto de cero si el proveedor o comprobante declara `S/M`. Tambien bloquea IVA positivo con configuracion `E`. Una factura gravada exige indicadores explicitos validos tanto del proveedor como del comprobante; datos ausentes, desconocidos o filas comerciales contradictorias quedan bloqueados. Conserva neto, IVA y total en la vista previa; no convierte a bruto por inferencia ni produce un payload enviable. Solo `N/O` confirmados en ambos mantienen precio neto. Con IVA cero, neto y total coinciden y este bloqueo no aplica.

**Confirmacion explicita por factura:** el responsable puede confirmar un unico item de gasto, cantidad 1 y precio total con IVA incluido. `confirmZetaPurchaseExpensePriceInputReview` prepara primero una vista previa sin escrituras; guardar exige actor con rol autorizado, confirmacion humana y la huella de esa vista previa. La decision queda en `documents.metadata.zeta_purchase_price_input_review`, con auditoria y actualizacion condicionada a la version del documento. Se exige proveedor `S/M`, configuraciones validas, una sola agrupacion de concepto e IVA, y coincidencia a centesimos entre precio, neto, impuesto y total. La huella vincula documento, borrador, hechos, lineas, pago y configuracion aplicable: si cambian, hace falta otra revision. No crea una regla global para otros proveedores ni modifica el original, los maestros o las cuentas.

El caso autorizado de comida se resume como `Comida`, cantidad 1 y total de la factura como `PrecioUnitario`; el detalle de los productos permanece en Convertilabs. La API sigue recibiendo `CodigoIVA` y los pagos por el total. La conciliacion de este camino exige comprobar neto, IVA y total devueltos por `QueryCompras`. Una respuesta con total correcto pero desglose distinto o ausente queda pendiente con su reserva intacta; la copia mensual que valida solo el total no la promueve a conciliada. Confirmar este precio tampoco evita el control mensual ni habilita otro intento de alta. Los documentos con intentos o reservas previos requieren conciliacion antes de cambiar la decision de precio mediante este servicio.

En la interfaz de Zeta el campo Importe puede incluir IVA: un gasto de total388, neto318.03 e IVA69.97 requiere comparar esos tres resultados antes de guardar. No copiar el neto al Importe por su nombre ni trasladar automaticamente el comportamiento UI al contrato REST. Una conciliacion del piloto debe comprobar neto, IVA y total, ademas de identidad y fecha.

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
