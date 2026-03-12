# Spec 03 - Procesamiento de factura de compra

**Estado:** Approved  
**Prioridad:** P0  
**Dependencias:** `01`, `02`, `05`, `06`, `07`

---

## 1. Alcance V1 aprobado

Compra V1 cubre:

- PDF o imagen de factura de compra
- clasificacion como `purchase`
- draft editable
- sugerencia contable
- sugerencia IVA
- confirmacion final unica

Fuera de automatizacion V1:

- importaciones
- servicios del exterior
- lineas de detalle obligatorias
- matching contra OC o pagos

---

## 2. Catalogo inicial aprobado

Categorias de compra soportadas explicitamente:

- `goods_resale`
- `services`
- `admin_expense`
- `transport`
- `fuel_and_lubricants`
- `professional_fees`
- `rent`

Si una compra cae fuera de ese catalogo, el sistema no inventa. Deja draft y bloqueo o warning segun corresponda.

---

## 3. Tratamiento IVA V1

La capa fiscal V1 para compras solo resuelve:

- `input_creditable`
- `input_non_deductible`
- `input_exempt`

No resuelve IRAE ni otros dominios.

---

## 4. UX V1

La review de compra expone:

- preview del documento
- identidad
- datos extraidos
- importes
- categoria operativa
- sugerencia contable
- sugerencia IVA
- confirmacion final

No hay aprobaciones por paso.

---

## 5. Estado de implementacion

Implementado:

- draft persistente de compra
- review page org-scoped
- categoria operativa editable
- sugerencia contable V1
- tratamiento IVA V1
- confirmacion final

Pendiente:

- heuristicas mas ricas para casos multi-tasa
- matching contra proveedores maestros
- politicas mas finas para no deducible segun rubro real
