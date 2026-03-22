# Product language and copy dictionary

## Objetivo

Fijar un lenguaje oficial para Convertilabs.

La meta no es embellecer copy. La meta es evitar que la misma cosa tenga nombres distintos
segun pantalla, iteracion o capa tecnica.

## Regla editorial

- una misma decision visible debe tener un solo nombre principal;
- si existe un termino tecnico y uno de producto, la UI simple usa el de producto;
- la vista avanzada puede mostrar el tecnico como detalle secundario;
- ningun boton debe sonar mas definitivo de lo que realmente hace.

## Nombres oficiales de etapas en revision documental

- `Estado actual del documento`
- `Paso 1 - Revisar datos del comprobante`
- `Paso 2 - Completar contexto contable`
- `Paso 3 - Confirmar clasificacion y cuentas`
- `Paso 4 - Ver impacto contable y fiscal`
- `Paso 5 - Decidir aprendizaje`
- `Paso 6 - Cerrar documento`

## Nombres oficiales de estados de workflow

- `Pendiente de revision factual`
- `Pendiente de asignacion`
- `Pendiente de aprendizaje`
- `Listo para posting provisional`
- `Posteado provisional`
- `Listo para confirmacion final`
- `Confirmado final`
- `Reabierto para remap`
- `Bloqueado`

## Nombres oficiales de fuentes de resolucion

- `Regla`
- `IA`
- `Revision manual`
- `Mixto`
- `Pendiente`

## Nombres oficiales de estado contable

- `Borrador`
- `Listo para provisional`
- `Posteado provisional`
- `Listo para final`
- `Posteado final`
- `Bloqueado`

## CTA oficiales

### Reviewer documental

- `Guardar contexto documental`
- `Guardar y recalcular sugerencia`
- `Guardar cuentas seleccionadas`
- `Confirmar asignacion manual`
- `Recalcular clasificacion con este contexto`
- `Postear provisional`
- `Confirmar final`
- `Reabrir revision`

### Tax

- `Ver preview operativo`
- `Generar corrida oficial`
- `Reabrir corrida`
- `Exportar reporte`

## Terminos que no deberian dominar la UI simple

- `assignment run`
- `second pass`
- `posting status`
- `manual_override_account_id`
- `assistant run`
- `input hash`

## Traduccion recomendada de jerga tecnica

- `posting status` -> `estado contable`
- `workflow state` -> `etapa actual`
- `manual override` -> `revision manual`
- `second pass` -> `segunda revision IA`
- `assignment run` -> `corrida de clasificacion`
- `draft ready` -> `listo para revisar`
- `vat run` -> `corrida oficial de IVA`
- `vat preview` -> `preview operativo de IVA`

## Reglas para blockers

Todo blocker visible debe responder estas tres preguntas:

1. que falta
2. por que falta
3. que tiene que hacer el usuario ahora

## Reglas para botones deshabilitados

Un boton deshabilitado debe tener razon visible cerca del boton o dentro del checklist.

No esconder la razon real detras de un tooltip vago.

## Regla de honestidad

No usar:

- `confirmar` para algo que solo guarda
- `final` para algo que solo recalcula
- `listo` cuando solo existe un artefacto tecnico vacio

## Regla para IVA

Siempre distinguir:

- `Preview operativo del periodo`
- `Corrida oficial del periodo`

Nunca presentarlos como si fueran lo mismo.
