# DOC-001: upload conectado al dashboard

## Objetivo

Conectar la shell privada de `DASH-001` con un flujo de upload real:

- metadata inicial en `public.documents`
- archivo directo a `storage.objects` del bucket privado
- cierre de estado a `uploaded`
- error recuperable con fila visible en dashboard

## Decisiones implementadas

- El bucket operativo sigue siendo `documents-private`, consistente con el canon del proyecto y con la estrategia de buckets privados de `docs/doc_document_intake.md`.
- El path de Storage es determinista y tenant-aware: `orgs/<organization_id>/<document_id>/<sanitized_filename>`.
- El navegador sube directo a Supabase Storage con un token efimero de upload generado en servidor; no se pasa el archivo por Vercel.
- La preparacion y cierre del upload van por RPCs controlados:
  - `public.prepare_document_upload(...)`
  - `public.complete_document_upload(uuid)`
  - `public.fail_document_upload(uuid, text)`
- Las policies de `storage.objects` siguen definidas en el canon SQL y se apoyan en el path y en la fila real de `public.documents`, de modo que el objeto y la metadata queden acoplados al mismo `document_id` cuando el entorno las pueda aplicar con un rol owner de `storage.objects`.

## Validaciones de Semana 1

- MIME permitidos:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
- tamano maximo: `20 MB`
- sin `upsert`
- nombre saneado en SQL con `public.sanitize_document_filename(text)`

## Entregables del repo

- `app/app/o/[slug]/dashboard/actions.ts`
- `components/documents/upload-button.tsx`
- `components/documents/upload-dropzone.tsx`
- `modules/documents/upload.ts`
- `db/schema/04_documents.sql`
- `db/rls/supabase_rls_policies.sql`
- `supabase/migrations/20260311_doc001_documents_upload.sql`
- `scripts/supabase/smoke-document-upload.mjs`

## Flujo operativo

1. El dashboard llama `prepareDashboardDocumentUpload`.
2. La Server Action resuelve la organizacion por slug y ejecuta `public.prepare_document_upload(...)`.
3. El RPC crea la fila `documents` con `status = 'uploading'`, bucket privado, `storage_path` determinista y `uploaded_by = auth.uid()`.
4. La Server Action emite un token de upload firmado para ese `storage_path`.
5. El browser sube el archivo a `documents-private` usando `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, { upsert: false })`.
6. Si Storage responde bien, la app ejecuta `public.complete_document_upload(...)`.
7. Si Storage falla o el cierre no puede completarse, la app ejecuta `public.fail_document_upload(...)` y refresca el dashboard para dejar trazabilidad visible.

## Contrato de seguridad

- `public.documents` mantiene RLS por membresia de organizacion.
- `storage.objects` solo permite:
  - `select` a miembros de la organizacion del objeto
  - `insert` al uploader autenticado del documento en estado `uploading`
- El bucket no expone URLs publicas.
- El path por si solo no autoriza nada; la policy tambien exige una fila coincidente en `public.documents`.
- En Supabase remoto, si el rol de despliegue no es owner de `storage.objects`, la migracion salta esas policies sin romper el resto del rollout y el runtime sigue funcionando via signed upload URLs.

## Estados de UI

- `idle`
- `validating`
- `uploading`
- `success`
- `error`

## Rollout y QA

- Aplicar `20260311_doc001_document_status_enum.sql` y luego `20260311_doc001_documents_upload.sql` sobre entornos que ya tengan `AUTH-001`, `ORG-001` y `DASH-001`.
- Regenerar el sync canonico con `npm run db:generate:migration`.
- Verificar paridad con `npm run db:verify:parity`.
- Ejecutar `npm run db:smoke:document-upload`.
- Validacion manual minima:
  - PDF valido
  - JPG o PNG valido
  - MIME invalido
  - archivo > 20 MB
  - fallo de red durante upload
  - aislamiento entre organizaciones
