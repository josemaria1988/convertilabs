# Importacion documental Zeta por planilla

## Objetivo del documento

Dejar documentado el soporte real y vigente para layouts mensuales de Zetasoftware dentro del carril `Auditoria`.

## Archivos principales

- `modules/documents/zeta-purchase-import.ts`
- `modules/documents/zeta-sale-import.ts`
- `modules/documents/spreadsheet-batch-import.ts`
- `modules/documents/spreadsheet-import-background.ts`
- `tests/document-spreadsheet-batch-import.test.cjs`

## Cobertura implementada hoy

El repo ya soporta deteccion y normalizacion deterministica para:

- compras mensuales tipo Zeta;
- ventas mensuales tipo Zeta;
- consolidacion por factura usando `sourceRows` y `sourceRowNumbers`;
- notas de credito detectadas por tipo, texto o signo;
- RUT normalizado;
- fechas textuales y seriales de Excel;
- moneda y `documentFxRate` preservados cuando vienen en la planilla;
- inferencia o lectura de tasa IVA por label y por montos;
- guardrails de duplicado antes de materializar documentos.

## Flujo real

1. la planilla entra por `/app/o/[slug]/audit`;
2. el sistema hace preflight deterministico y valida headers/cantidad;
3. si reconoce layout Zeta, usa los normalizadores dedicados de compras o ventas;
4. la corrida deja preview estructurado en `organization_spreadsheet_import_runs`;
5. el usuario acepta o rechaza filas o subconjuntos;
6. solo lo aceptado materializa `documents` con `source_type = spreadsheet_import`;
7. esos documentos vuelven al carril normal de `Documentos`.

## Artefactos que ya preserva

- `sourceRows`
- `sourceRowNumbers`
- `consolidationKey`
- `isCreditNote`
- `documentFxRate`
- `documentFxRateSource`
- `documentFxRateDate`
- warnings de importacion y trazabilidad del archivo origen

## Limites actuales

- este soporte esta pensado para intake documental auditado, no como bridge ERP general;
- si el layout no entra por reconocimiento deterministico, el flujo cae al carril generico de mapping/manual review;
- un FX faltante o no confiable puede dejar el documento fuera del alcance automatico aunque la fila haya importado bien;
- la aceptacion de la fila no garantiza por si sola posting final: el documento igualmente pasa por revision, clasificacion y locks del periodo.
