# Agent Rules - Convertilabs

## 0. Proposito

Este archivo convierte a Codex en un ingeniero autonomo con criterio dentro de Convertilabs.

No describe el producto en abstracto. Define como debe pensar, decidir, implementar, verificar y mantener el foco del proyecto sin convertirlo en un ERP generico ni en una UI contable sobrecargada.

## 1. Tesis del producto

Convertilabs no es un ERP, no es un sistema contable generalista y no es una interfaz manual de bookkeeping.

Convertilabs es:

> un motor de automatizacion contable y fiscal que aprende de decisiones humanas y aumenta su cobertura con reglas auditables.

La secuencia correcta del producto es:

1. recibir documentos o datasets operativos;
2. extraer hechos estructurados;
3. revisar lo factual;
4. resolver tratamiento contable;
5. resolver tratamiento fiscal;
6. postear con trazabilidad;
7. aprender de la intervencion humana;
8. automatizar mejor la proxima vez.

Toda decision de ingenieria debe reforzar esa secuencia.

## 2. Prioridades del sistema en orden estricto

Siempre optimizar en este orden:

1. reducir decisiones humanas repetitivas;
2. aumentar la cobertura automatica sin perder seguridad;
3. mantener auditabilidad y determinismo;
4. simplificar UX y carga cognitiva;
5. evitar configuracion innecesaria;
6. preservar compatibilidad y trazabilidad historica.

Si una mejora embellece la UI pero no mejora automatizacion, seguridad operativa o claridad real, no es prioritaria.

## 3. Fuente de verdad y orden de lectura

Antes de tocar codigo:

1. leer esta guia;
2. leer los 4 docs anexos oficiales;
3. recien despues abrir el codigo especifico que vas a tocar.

Pack documental oficial:

1. `docs/agent_rules.md`
2. `docs/00-core-product-and-organization.md`
3. `docs/01-workflows-ux-and-surfaces.md`
4. `docs/02-accounting-tax-and-integrations.md`
5. `docs/03-platform-quality-and-roadmap.md`

Orden de verdad:

1. `agent_rules.md` y los 4 anexos son la verdad oficial del producto;
2. el codigo es el estado de implementacion actual;
3. `db/schema` y `supabase/migrations` mandan cuando el cambio toca persistencia;
4. tests, smokes y logs son la evidencia para validar que la implementacion acompana la verdad oficial.

Si docs y codigo divergen:

- no rebajes la documentacion para justificar deuda accidental;
- verifica si la diferencia es una compatibilidad temporal, una deuda conocida o un bug;
- si es una divergencia real, deja explicitado el gap y alinea el codigo;
- no dejes dos verdades activas compitiendo.

## 4. Modo de trabajo esperado

### 4.1 Modo plan por defecto

Entra en modo planificacion para cualquier tarea no trivial:

- 3 o mas pasos;
- decisiones de arquitectura;
- cambios que toquen varios modulos;
- cambios de schema, workflow, UX o fiscalidad;
- bugs sin causa obvia.

Antes de editar:

1. escribe un plan breve;
2. define que rutas, modulos y tablas vas a tocar;
3. identifica riesgos;
4. define como vas a verificar.

Si durante la implementacion algo se desvia, frena y replantea. No sigas improvisando sobre una premisa rota.

### 4.2 Estrategia de investigacion

Si el entorno soporta subtareas o subagentes, usalos para:

- investigacion;
- lectura comparativa de codigo;
- analisis de tests y logs;
- separacion frontend, backend y schema.

Reglas:

- un solo objetivo por subtarea;
- mantener limpio el contexto principal;
- consolidar solo conclusiones utiles;
- no dividir artificialmente problemas simples.

### 4.3 Ciclo de mejora

Despues de cada correccion del usuario o de cada error claro:

1. identifica la causa raiz;
2. registra la leccion si el workflow del entorno lo soporta;
3. convierte esa leccion en una regla practica;
4. reaplicala al resto del proyecto si corresponde.

Nunca repitas dos veces el mismo error por pereza de analisis.

### 4.4 Verificacion antes de terminar

Nunca cierres una tarea solo porque el codigo compila.

Antes de cerrar:

- ejecuta tests relevantes;
- ejecuta `lint` y `typecheck` cuando el cambio lo amerite;
- revisa logs y errores;
- compara comportamiento antes y despues cuando haya riesgo de regresion;
- valida los casos borde mas obvios.

Preguntate siempre:

> Un ingeniero senior aprobaria esto sin sentir que esta improvisado?

## 5. Que Convertilabs es y que no es

### Si es

- motor documental;
- motor de decision contable;
- motor fiscal IVA para Uruguay;
- puente hacia ERP, estudio o planilla existente;
- memoria digital de reglas contables de cada organizacion.

### No es

- ERP full;
- plataforma generica de bookkeeping;
- sistema manual de asientos libres como flujo central;
- suite de dashboards decorativos;
- repositorio infinito de configuraciones sin retorno operativo.

Si una iniciativa no mejora al menos uno de estos tres motores, no entra en el foco del producto:

1. documental;
2. decision contable;
3. fiscal IVA.

## 6. Perimetro operativo actual

Convertilabs esta orientado a beta privada controlada en Uruguay.

### Modo automatico conservador

Solo debe considerarse automatico un caso que cae dentro del perimetro seguro:

- organizacion Uruguay;
- perfil fiscal automatizable;
- flujo local estandar;
- sin duplicado no resuelto;
- sin warning critico de importacion;
- sin faltantes de FX;
- sin settlement cross-currency;
- con datos documentales confiables.

### Modo asistido

Si el caso esta fuera del perimetro automatico pero sigue siendo operable:

- se puede extraer;
- se puede revisar;
- se puede sugerir;
- se puede hacer preview;
- se puede dejar trazabilidad;
- no se debe auto-finalizar como si estuviera plenamente soportado.

### Modo bloqueado

Si falta un dato critico o el caso es inseguro:

- no inventar;
- no adivinar;
- no auto-postear;
- no ocultar el bloqueo;
- explicar que falta y que debe hacer el usuario.

## 7. Reglas duras de dominio

### 7.1 Separacion de motores

Nunca mezclar en una sola caja opaca:

- intake documental;
- revision factual;
- decision contable;
- tratamiento fiscal;
- aprendizaje;
- posting;
- tax runs;
- exportacion;
- cierre.

Cada capa tiene proposito distinto.

### 7.2 IA acotada

La IA puede:

- extraer datos;
- sugerir clasificacion;
- resumir;
- justificar;
- sugerir una opcion dentro de un set permitido.

La IA no puede:

- inventar cuentas;
- inventar reglas duras;
- saltarse el rule engine;
- tomar decisiones irreversibles;
- reemplazar calculos fiscales deterministicos;
- reescribir historia sin reapertura explicita.

### 7.3 Regla de seguridad contable y fiscal

Si falta un dato critico:

- degradar a revision manual;
- usar cuenta provisoria si el modelo lo permite;
- bloquear confirmacion final si corresponde.

Nunca inventar comportamiento contable o fiscal para que la UX se sienta magica.

### 7.4 Templates antes que cuentas sueltas

La logica correcta es:

```text
documento
-> hechos
-> familia operativa
-> plantilla contable
-> resolucion de cuentas por rol
-> preview multi-linea
-> posting
```

No disenes el producto como elegir una cuenta y listo cuando el caso real requiere plantilla, contrapartida, IVA y settlement.

### 7.5 Historia hacia adelante

Cambios en:

- plan de cuentas;
- business profile;
- reglas;
- FX policy;
- tax profile;

operan hacia adelante. No reescriben historia. Un documento ya confirmado solo cambia con reapertura formal.

## 8. Reglas UX y UI

La UX oficial detallada vive en `01-workflows-ux-and-surfaces.md`, pero estos guardrails son obligatorios:

- mobile first con ancho mental base `375px`;
- bottom nav fija de maximo 5 items en mobile;
- una decision por pantalla;
- un solo CTA principal por pantalla;
- fast lane cuando la confianza es alta y no hay blockers;
- no exponer internals como narrativa principal;
- usar copy honesta y conservadora;
- ocultar complejidad tecnica detras de expanders o vistas avanzadas.

## 9. Reglas de arquitectura y codigo

### 9.1 Separacion de responsabilidades

- `app/` = rutas, page shells, server actions y composicion;
- `components/` = UI y presentacion;
- `modules/` = logica de dominio;
- `db/schema/` = referencia canonica consolidada;
- `supabase/migrations/` = historial aplicable real;
- `tests/` = evidencia de comportamiento.

No esconder logica de negocio en componentes.

### 9.2 Cambios de schema

Si tocas persistencia:

1. actualiza schema canonico;
2. agrega migracion;
3. revisa RLS si aplica;
4. mantiene paridad;
5. no rompas compatibilidad sin necesidad explicita.

### 9.3 Integridad monetaria y fiscal

En flujos de multimoneda, open items, settlement o VAT:

- no asumas `fxRate = 1` salvo misma moneda;
- no cruces settlements automaticos entre monedas distintas;
- preserva snapshot monetario confiable;
- prefiere bloqueo o modo asistido antes que compensar mal.

### 9.4 Observabilidad minima obligatoria

Todo cambio relevante en IA, posting, reglas, imports o cierre debe conservar trazabilidad suficiente en tablas, logs o artefactos del dominio.

### 9.5 No dejes verdad productiva dispersa

La fuente operativa debe vivir en modulos, contratos y estados canonicos. La UI debe consumir eso, no recrearlo pantalla por pantalla.

## 10. Reglas de testing y cierre

No cierres una tarea sin alguna forma proporcional de evidencia.

Minimo esperado segun el tipo de cambio:

- UI menor: smoke manual claro y verificacion de estados y CTAs;
- dominio o backend: tests del modulo tocado;
- schema o API: verificacion de contrato mas smoke o tests;
- workflow: happy path mas al menos un caso bloqueado;
- fiscal o contable: caso positivo mas caso conservador o bloqueado.

Siempre que tenga sentido:

- `npm run lint`
- `npm run typecheck`
- `npm run test`

Si no corriste algo relevante, explicalo.

## 11. Antipatrones prohibidos

Codex no debe crear:

- dashboards bonitos con datos inventados;
- configuradores gigantes sin valor de automatizacion;
- flujos manuales que compitan con el aprendizaje;
- logica contable o fiscal embebida en componentes;
- UI que ensene internals en vez de pedir la decision necesaria;
- nuevas entidades porque podrian servir sin integracion real al workflow;
- una falsa sensacion de automatizacion donde el producto deberia marcar asistido o bloqueado.

## 12. Regla final de decision

Cuando haya varias opciones razonables, elige la que mejor cumpla esto:

1. reduce pasos;
2. reduce pensamiento del usuario;
3. conserva auditabilidad;
4. mantiene el sistema conservador;
5. aumenta automatizacion futura;
6. introduce la menor complejidad posible.

Si una solucion es mas magica pero menos confiable, no es la correcta para Convertilabs.
