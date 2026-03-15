# Vision rectora V1

## Proposito

Este documento consolida la tesis larga del proyecto y la aterriza al estado real del repo al 2026-03-15.

El rector no se usa como lista abstracta de deseos. Se usa como marco para responder tres preguntas:

1. que es Convertilabs;
2. que entra realmente en V1;
3. que ya existe, que esta parcial y que solo queda preparado.

## Tesis de producto

Convertilabs no apunta a ser un ERP generalista.

La posicion correcta del producto es:

- capa de decision fiscal para Uruguay;
- capa de estructuracion contable explicable;
- capa de control operativo por documento, costo y margen;
- puente de exportacion hacia ERP, estudio o planilla existente.

La promesa de producto sigue esta secuencia:

1. recibir documentos y datos operativos;
2. extraer y normalizar hechos;
3. decidir tratamiento contable y fiscal con trazabilidad;
4. permitir clasificacion, override y aprendizaje controlado;
5. calcular impuestos y preparar exportaciones;
6. explicar que se hizo, por que y con que impacto.

## Alcance V1 adoptado

### Entra en V1

- auth SSR con Supabase y tenancy por organizacion;
- unicidad organizacional por RUT normalizado;
- onboarding con perfil fiscal base, actividad, secundarias y traits;
- plan de cuentas del sistema con presets modulares;
- recomendacion de presets por reglas y capa hibrida opcional con IA;
- importacion de planillas para historicos IVA, templates y plan de cuentas;
- intake documental con upload privado, OCR/extraccion IA y draft persistido;
- workspace de revision contable y fiscal separado de la extraccion;
- rule engine, learning explicito y explainability visible;
- posting provisional y posting final;
- VAT preview, VAT run y conciliacion DGI base;
- soporte inicial multimoneda y hooks de FX fiscal;
- carril inicial de importaciones/DUA;
- exportacion contable y exportacion fiscal;
- snapshots versionados, decision logs y auditoria de corridas IA.

### Queda fuera de V1

- emision CFE;
- stock operativo tiempo real;
- payroll full;
- CRM, compras y tesoreria bancaria avanzada;
- cost centers y jobs como modulo productivo completo;
- otros motores tributarios listos para liquidacion operativa fuera de IVA.

## Principios no negociables

### Separacion de bloques

El repo debe mantener separadas estas capas:

- ingesta y extraccion;
- validacion factual;
- clasificacion contable;
- tratamiento fiscal;
- aprendizaje;
- posting;
- tax runs;
- exportacion;
- reporting.

### IA acotada

La IA puede:

- extraer campos;
- elegir dentro de sets permitidos;
- resumir;
- justificar;
- sugerir observaciones.

La IA no puede:

- inventar cuentas fuera del set habilitado;
- crear reglas duras sola;
- reprocesar historicos sin accion explicita;
- sustituir snapshots o auditoria.

### Explainability obligatoria

Toda decision material debe poder explicarse:

- cuenta sugerida;
- regla aplicada;
- tratamiento IVA;
- warning geografico;
- posting provisional/final;
- preset recomendado;
- exportacion generada;
- motivo de bloqueo o revision.

### Configuracion hacia adelante

Cambiar plan, traits o reglas no reescribe historia. Los documentos ya confirmados quedan anclados a sus snapshots y solo cambian si se reabren de forma explicita.

## Estado actual frente al rector

### Implementado hoy

- tenancy y auth SSR con guardas por organizacion;
- creacion de organizacion unica por RUT;
- onboarding con actividad, secundarias, traits y descripcion corta;
- business profile versionado;
- preset recommendation engine por reglas;
- flujo hibrido de recomendacion IA para presets con auditoria;
- upload privado de documentos y pipeline con Inngest + OpenAI;
- draft persistido con pasos editables;
- workspace de revision y clasificacion;
- motor de reglas con scopes `document_override`, `vendor_concept`, `concept_global`, `vendor_default` y `vendor_concept_operation_category`;
- posting provisional y final;
- reopen sin rerun automatico de IA;
- VAT preview, VAT run, export y conciliacion DGI base;
- imports por planilla y carril de importaciones;
- export bridge contable generico;
- decision logs, audit log y trazabilidad de corridas IA.

### Parcial o en consolidacion

- desacople visual total entre cola de extraccion y cola de asignacion;
- multimoneda con persistencia de FX fiscal en todo el flujo;
- importaciones profundas con costos capitalizables completos;
- explainability transversal uniforme en todas las vistas;
- export adapters por ERP especifico.

### Solo preparado

- centros de costo y jobs como entidades reales;
- profitability por trabajo/proyecto;
- motores IRAE, IPAT, ICOSA, BPS y retenciones;
- APIs publicas estables para terceros;
- operaciones masivas con session rules o batch learning avanzado.

## Mapa rector por modulo

- Modulo A y B del rector: `01-identity/` y `02-organization/`
- Modulo C y D: `03-accounting/` y `06-integrations/`
- Modulo E a L: `04-documents/`
- Modulo M a P: `05-tax/`
- Modulo Q: `09-future/`
- Modulo R y S: `05-tax/` y `06-integrations/`
- Modulo T: `07-platform/`

## Referencias normativas y de diseno a preservar

- DGI CIIU e INE Vulcano para clasificacion de actividades.
- DGI formulario 0351 como referencia registral.
- DGI Sigma, criterios de IVA compras, operaciones gravadas/no gravadas y moneda extranjera.
- BCU para cotizaciones oficiales.
- BPS y Aduanas como fuentes externas futuras o parciales.

Estas fuentes guian las reglas del producto, pero el repo todavia no implementa ingestiones oficiales completas para todas ellas.
