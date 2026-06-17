# PR-09 - Directorio e Historial MVP

## Objetivo

Convertir `parties` en la superficie visible de clientes, proveedores, bancos, organismos y contactos, con historial operativo vinculado a entidades reales.

## Entregado

- Modulo `modules/communications` para interacciones, participantes y links.
- Repositorio de directorio sobre `parties`, `party_roles`, `party_identifiers`, `contacts` y `party_contacts`.
- Ruta privada `/app/o/[slug]/directory`.
- Ruta privada `/app/o/[slug]/directory/[partyId]`.
- Redirect global `/directory`.
- Alta de party con multiples roles.
- Perfil de party con identificadores, contactos, trabajos, documentos, dinero, tareas e interacciones.
- Alta de contacto desde perfil.
- Registro de interaccion vinculable a party, contacto, trabajo, documento y tarea.
- Hub "Mas" actualizado con Directorio, Procesos y Continuidad.

## Criterios cubiertos

- Una party puede ser cliente y proveedor.
- Una party puede tener multiples contactos.
- Una interaccion puede vincularse a trabajo y documento.
- El historial queda filtrado por organizacion.
- Los adapters legacy de vendors/customers siguen disponibles.

## Tests

- `tests/directory-communications-mvp.test.cjs`

