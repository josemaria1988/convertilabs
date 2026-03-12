# Scope map - De la idea inicial al alcance corregido

**Estado:** Draft  
**Objetivo:** dejar trazado qué cambió respecto al corte anterior

---

## 1. Alcance inicial simplificado

El corte anterior proponía:

- PDF de factura de compra
- extracción
- draft editable
- sugerencia de asiento
- sugerencia fiscal
- confirmación final
- normativa tributaria base para ese caso

---

## 2. Corrección de alcance necesaria

Ese corte es útil como slice técnico, pero insuficiente como sistema tributario serio porque omitía dos bases:

1. **perfil jurídico/tributario de la organización**
2. **factura de venta** como pata simétrica y tributariamente crítica

---

## 3. Alcance corregido para decisiones

El sistema ahora debe considerarse dividido en:

### Base 1 - Perfil organizacional
Sin esto, no hay encuadre correcto.

### Base 2 - Pipeline documental
Sin esto, no hay datos.

### Base 3 - Compra
Primer slice operativo razonable.

### Base 4 - Venta
Segundo slice bloqueante o V1.1, según decisión.

### Base 5 - Draft editable
Human-in-the-loop con persistencia.

### Base 6 - Sugerencia contable
Editable, estructurada y auditada.

### Base 7 - Sugerencia fiscal
Editable, estructurada y soportada por normativa.

### Base 8 - Confirmación y reapertura
Para no perder control cuando el usuario se apura.

### Base 9 - Base normativa viva
Para que el sistema no envejezca mal.

---

## 4. Decisión pendiente de producto

**OPEN:** ¿El release V1 comercialmente aceptable es:

- `V1A`: perfil + compra + draft + fiscal + asiento + confirmación + normativa base
- `V1B`: todo lo anterior + venta procesada
- `V1C`: todo lo anterior + pre-emisión de venta

No debe asumirse ninguna de las tres opciones sin decisión explícita.

---
