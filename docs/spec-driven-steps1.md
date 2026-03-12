Convenciones base para todas las specs

Stack asumido: Next.js App Router + TypeScript + Supabase + Vercel. Para auth SSR, normaliza todo en @supabase/ssr; Supabase ya marca auth-helpers como deprecado y el paquete SSR es el camino vigente para clientes browser/server con sesión en cookies.

Flujo de auth en SSR: usa PKCE + cookies. Si confirmas email en SSR, el flujo correcto es enviar al usuario a un endpoint tipo /auth/confirm que reciba token_hash y lo canjee por una sesión.

Profiles: cualquier trigger sobre auth.users debe ser mínimo. Supabase avisa que si el trigger falla, puede bloquear el signup; por eso profiles sí, pero la creación de organización la movemos al onboarding.

Seguridad de datos: el cliente del navegador debe usar la anon key, nunca la service role. Con RLS activado, ese patrón es el esperado por Supabase.

Storage: el bucket de documentos será privado. En buckets privados todo pasa por RLS sobre storage.objects; subir requiere al menos política INSERT, y si no haces upsert no necesitas abrir permisos extra de overwrite.

Redirect URLs y emails: cualquier redirectTo usado por auth debe existir en la lista de Redirect URLs de Supabase, y las plantillas de email deben alinearse con el flujo SSR.

## 1) AUTH-001: arreglar profiles y auth
Objetivo

Garantizar que todo usuario autenticado tenga su fila en public.profiles, que el flujo de signup/login/logout funcione bien en SSR, y que la confirmación por email desemboque en una sesión válida y una redirección limpia. Si “el usuario existe en auth pero no en tu BD” sigue ocurriendo, lo demás es teatro.

Resultado esperado

Nuevo signup crea fila en auth.users.

Se crea automáticamente la fila espejo en public.profiles.

Si Confirm email está activo, el signup devuelve user pero no session; el usuario confirma por email y luego aterriza con sesión válida.

Los usuarios antiguos que ya existían en auth.users quedan backfilleados en profiles.

Las rutas privadas ya no dependen de hacks cliente-side.

Alcance

Tabla public.profiles

Trigger handle_new_user

Script de backfill

Cliente Supabase SSR browser/server

Middleware/proxy de refresh de cookies

Rutas /login, /signup, /auth/confirm, /logout

Redirección post-auth a onboarding o dashboard

No alcance

Social login

MFA

Gestión avanzada de perfil

Cambio de email/contraseña con UX pulida

Passwordless, salvo que ya lo estés usando

Contrato de datos

Propón profiles así:

id uuid primary key references auth.users(id) on delete cascade

email text

full_name text null

avatar_url text null

created_at timestamptz default now()

updated_at timestamptz default now()

Decisión importante: si guardas email en profiles, documenta si será copia denormalizada o campo fuente. Para Semana 1, que sea copia denormalizada y acepta que más adelante puedes añadir trigger de update si habilitas cambio de email.

Subtareas de implementación

AUTH-001.1 Auditar el estado actual

Confirmar si el proyecto usa @supabase/ssr o todavía arrastra helpers viejos.

Revisar dónde se crea la sesión, cómo se refrescan cookies y qué rutas privadas existen hoy. Supabase recomienda @supabase/ssr con cliente browser/server, y en Next.js hace falta una capa que refresque tokens y escriba cookies porque los Server Components no pueden hacerlo por sí solos.

AUTH-001.2 Crear la migración de profiles

Crear tabla public.profiles.

Índice por email.

RLS activado.

Policies:

SELECT: solo auth.uid() = id

UPDATE: solo auth.uid() = id

sin INSERT directo desde cliente

AUTH-001.3 Trigger mínimo de creación

Crear función public.handle_new_user().

Trigger after insert on auth.users.

Insertar solo:

id = new.id

email = new.email

full_name desde raw_user_meta_data si existe

on conflict do nothing

Nada de crear organización aquí. Si el trigger de auth.users falla, Supabase puede bloquear el alta del usuario; por eso la lógica debe ser corta, determinista y bien testeada.

AUTH-001.4 Backfill de usuarios existentes

Script SQL:

insert into public.profiles (...) select ... from auth.users

where not exists (...)

Ejecutarlo una vez en staging y luego en producción

Guardar el script en supabase/migrations o en scripts/backfills/ si prefieres separarlo

AUTH-001.5 Normalizar utilidades de Supabase
Entregables:

lib/supabase/client.ts

lib/supabase/server.ts

lib/supabase/middleware.ts o equivalente

Comportamiento:

Browser client para formularios y upload

Server client para Server Components, Route Handlers y Server Actions

Refresh de sesión vía middleware/proxy, como recomienda la guía SSR de Supabase.

AUTH-001.6 Confirmación de email SSR

Crear app/auth/confirm/route.ts

Leer token_hash y type

Canjearlos por sesión

Redirigir a un router intermedio, por ejemplo /auth/post-confirm

Ese router decide:

sin organización → /onboarding

con organización → /app/o/[slug]/dashboard

Supabase documenta este patrón para SSR: el endpoint recibe token_hash, lo intercambia por sesión y redirige.

AUTH-001.7 Reglas de redirección

Usuario no autenticado en ruta privada → /login?next=...

Usuario autenticado sin memberships → /onboarding

Usuario autenticado con 1 org → /app/o/[slug]/dashboard

Usuario autenticado intentando ir a /login o /signup → rebotar a destino útil

AUTH-001.8 Manejo de errores

Mensajes distintos para:

email ya registrado

credenciales inválidas

cuenta pendiente de confirmación

link inválido o expirado

Log centralizado para errores de auth

Criterios de aceptación

Un signup nuevo deja una fila en public.profiles.

Un usuario existente en auth.users pero no en profiles se corrige con el backfill.

En SSR, una navegación a ruta privada reconoce la sesión sin depender de estado cliente suelto en el aire.

Con confirmación de email activada, el usuario ve estado “revisa tu correo” y luego puede completar login tras el enlace.

QA mínimo

Signup nuevo

Login con usuario confirmado

Login con usuario no confirmado

Logout

Confirm link válido

Confirm link inválido / expirado

Usuario viejo backfilleado

Acceso directo a ruta privada sin sesión

Entregables de repo

supabase/migrations/*_profiles.sql

app/auth/confirm/route.ts

lib/supabase/*

docs/specs/auth-profiles.md

## 2) ORG-001: crear onboarding de organización
Objetivo

Crear el primer contexto multi-tenant real: usuario autenticado → crea su organización → queda como owner → entra a la app privada.

Resultado esperado

Un usuario sin organización es redirigido a /onboarding.

Puede crear una organización con nombre y slug.

Se crea su membresía con rol owner.

Sale del onboarding dentro de /app/o/[slug]/dashboard.

Alcance

Tabla organizations

Tabla organization_memberships

RLS de ambas

RPC o Server Action para crear organización + membership en una operación lógica

Ruta /onboarding

Redirect guards

No alcance

Invitaciones por email

Gestión multi-org avanzada

Switcher visual pulido

Billing

Roles complejos más allá de owner/admin/member

Contrato de datos

organizations

id uuid pk

name text not null

slug text not null unique

created_by_user_id uuid references public.profiles(id)

created_at timestamptz default now()

updated_at timestamptz default now()

organization_memberships

id uuid pk o PK compuesta si prefieres

organization_id uuid references organizations(id) on delete cascade

user_id uuid references public.profiles(id) on delete cascade

role text check (role in ('owner','admin','member'))

created_at timestamptz default now()

unique (organization_id, user_id)

Decisión de diseño

No hagas dos inserts separados desde el cliente y le reces a los dioses del networking. Haz una operación atómica vía RPC/función SQL o una Server Action que delegue en una función SQL. La función debe:

validar auth.uid() is not null

normalizar name

generar/validar slug

crear organizations

crear membership owner

devolver organization_id y slug

Subtareas de implementación

ORG-001.1 Migración base

Crear tablas

Crear índices:

organizations.slug

organization_memberships.user_id

organization_memberships.organization_id

Añadir timestamps

ORG-001.2 RLS
Policies mínimas:

organizations.SELECT: solo miembros de esa organización

organization_memberships.SELECT: solo miembros de esa organización

No abras INSERT directo de memberships al cliente normal

La creación inicial irá por función controlada

ORG-001.3 Helpers de autorización
Crear funciones reutilizables:

public.is_org_member(org_id uuid) returns boolean

public.is_org_owner(org_id uuid) returns boolean

quizá public.current_user_role(org_id uuid)

Te servirán luego para RLS en documents y storage.objects, en lugar de repetir subconsultas por todas partes.

ORG-001.4 Página /onboarding
UI mínima:

Título claro

Campo organization name

Preview de slug opcional

CTA “Crear organización”

Estado loading / error

Comportamiento:

Si el usuario ya tiene membership, /onboarding redirige fuera

Si no tiene membership, solo esa pantalla es válida

ORG-001.5 Slug

Slug generado en servidor, aunque lo previsualices en cliente

Regla: minúsculas, guiones, sin espacios ni caracteres raros

Si hay conflicto, sufijo incremental o hash corto

ORG-001.6 Redirect post-onboarding

Éxito → /app/o/[slug]/dashboard

Error recuperable → mensaje inline

Error fatal → no dejar al usuario en estado medio roto

Criterios de aceptación

Usuario autenticado sin memberships siempre acaba en /onboarding.

Crear organización lo convierte en owner.

Un usuario ajeno no puede leer esa organización ni sus memberships por RLS.

Repetir creación con el mismo nombre en otra cuenta no rompe el sistema: el slug se resuelve de forma única.

QA mínimo

Usuario nuevo crea primera org

Usuario ya onboardeado intenta volver a /onboarding

Colisión de slug

Error de red de creación

Acceso cruzado entre usuarios de distinta org

Entregables de repo

supabase/migrations/*_organizations.sql

app/onboarding/page.tsx

app/onboarding/actions.ts

docs/specs/onboarding-organizations.md

## 3) DASH-001: montar dashboard privado
Objetivo

Levantar una app shell privada que ya sea usable aunque esté vacía: autenticación correcta, contexto de organización correcto, lista de documentos vacía pero real, CTA de upload visible.

Resultado esperado

Existe un layout privado.

La organización actual se resuelve por slug.

Solo miembros válidos acceden.

El dashboard muestra estado vacío o lista de documentos.

La navegación ya existe para soportar Semana 2.

Alcance

Rutas privadas

Layout privado

Resolver org por slug

Verificar membership

Empty state

Lista básica de documentos

Barra superior mínima

No alcance

KPIs

métricas

búsqueda avanzada

filtros elaborados

preview de documento

multi-org switcher pulido

Rutas propuestas

/login

/signup

/onboarding

/app

/app/o/[slug]/dashboard

Comportamiento esperado

/app:

si no hay sesión → /login

si no hay org → /onboarding

si hay una org → redirect a /app/o/[slug]/dashboard

/app/o/[slug]/dashboard:

si no eres miembro → 404 o 403

si eres miembro → render del dashboard

Subtareas de implementación

DASH-001.1 Layout privado
Crear shell base con:

topbar

nombre de organización

usuario actual

logout

CTA de upload

DASH-001.2 Resolver el contexto de org

Buscar org por slug

Verificar membership del usuario autenticado

No filtrar por slug sin membership, para no filtrar información sensible

DASH-001.3 Query SSR
El dashboard debe cargarse desde servidor con el client SSR, no depender solo de hooks cliente, porque entonces conviertes la autorización en una forma de superstición con spinner.

DASH-001.4 Empty state
Cuando no haya documentos:

texto claro

CTA “Subir primer documento”

quizá una frase sobre formatos aceptados

DASH-001.5 Lista base de documentos
Columnas mínimas:

nombre de archivo

estado

fecha de subida

usuario que lo subió

DASH-001.6 Estados de UI

loading

empty

populated

error

Criterios de aceptación

Un usuario sin sesión nunca ve contenido privado.

Un usuario con sesión pero sin org cae en onboarding.

Un miembro ve solo su org y solo sus documentos.

Un usuario de otra org no puede abrir dashboard ajeno ni por URL directa.

QA mínimo

Ruta directa a /app

Ruta directa a /app/o/[slug]/dashboard

Acceso con y sin sesión

Slug inexistente

Slug existente pero sin membership

Estado vacío funcional

Entregables de repo

app/app/layout.tsx

app/app/page.tsx

app/app/o/[slug]/dashboard/page.tsx

components/dashboard/*

docs/specs/private-dashboard.md

## 4) DOC-001: conectar upload al dashboard
Objetivo

Permitir que un miembro de la organización suba un archivo al bucket privado, cree su metadata en la base de datos y lo vea reflejado en el dashboard.

Resultado esperado

Bucket documents privado

Tabla documents

Policies de DB y Storage

Componente de upload en dashboard

Fila visible tras subir archivo

Estado de error recuperable

Alcance

Modelo documents

Bucket privado

RLS sobre documents

RLS sobre storage.objects

Flujo de upload

Refresco del dashboard

No alcance

OCR

clasificación

preview

delete

rename

drag-and-drop ultra sofisticado

colas de procesamiento reales

Contrato de datos

documents

id uuid pk

organization_id uuid not null references organizations(id)

uploaded_by_user_id uuid not null references profiles(id)

original_filename text not null

storage_bucket text not null default 'documents'

storage_path text not null unique

mime_type text not null

size_bytes bigint not null

status text check (status in ('uploading','uploaded','error'))

created_at timestamptz default now()

updated_at timestamptz default now()

Convención de path

Usa un path determinista:

orgs/<organization_id>/<document_id>/<sanitized_filename>

Eso te permite aplicar políticas de Storage a partir del path. Supabase expone helpers como storage.foldername(name) para escribir RLS sobre storage.objects.

Decisión de arquitectura

No subas archivos pasando por Vercel si no hace falta. Para Semana 1, lo más limpio es:

Server Action o RPC crea una fila documents con status='uploading' y devuelve document_id + storage_path.

El browser client sube el archivo directamente a Supabase Storage.

Otra acción marca status='uploaded'.

Si falla la subida, marca status='error'.

Esto encaja bien con el modelo de Supabase: navegador con anon key + RLS.

Reglas de validación de Semana 1

MIME permitidos:

application/pdf

image/jpeg

image/png

tamaño máximo:

define uno ahora y no lo cambies cada dos días; recomiendo 20 MB

nombre saneado

sin upsert

No usar upsert simplifica policies, porque para upload básico basta con INSERT en storage.objects.

Subtareas de implementación

DOC-001.1 Migración documents

Crear tabla

Índices por organization_id, uploaded_by_user_id, status, created_at desc

DOC-001.2 RLS de documents
Policies:

SELECT: miembros de la org

INSERT: miembros de la org

UPDATE: miembros de la org sobre sus uploads o admins/owners, según quieras apretar más

Para Semana 1, basta con que cualquier miembro autenticado de la org pueda crear y ver

DOC-001.3 Bucket privado

Crear bucket documents

Confirmar que es privado

Documentar que no habrá URLs públicas. En buckets privados, el acceso pasa por auth o signed URLs.

DOC-001.4 RLS sobre storage.objects
Crear policies usando:

bucket_id = 'documents'

storage.foldername(name)

helper public.is_org_member(...)

Ejemplo lógico:

(storage.foldername(name))[1] = 'orgs'

(storage.foldername(name))[2]::uuid pertenece a una org del usuario actual

DOC-001.5 Componente de upload
UI mínima:

botón “Subir documento”

drag & drop opcional

progreso

errores inline

Estados:

idle

validating

uploading

success

error

DOC-001.6 Integración con dashboard

al terminar subida:

refrescar lista

mostrar nueva fila

si falla:

fila error

opción futura de retry

DOC-001.7 Auditoría mínima de metadata
Guardar:

quién subió

cuándo

org

tipo MIME

tamaño

Te servirá luego para OCR, clasificación y auditoría de Semana 4 sin reescribir media casa.

Criterios de aceptación

Un miembro puede subir PDF/JPG/PNG y verlo en la lista.

Un no miembro no puede subir ni listar archivos de otra org.

La metadata del documento y el objeto en Storage apuntan al mismo document_id.

Un fallo de upload no deja al usuario sin feedback.

QA mínimo

Upload PDF válido

Upload imagen válida

MIME no permitido

Tamaño excedido

Error de red durante upload

Acceso cruzado entre orgs

Refresco del dashboard tras éxito

Entregables de repo

supabase/migrations/*_documents.sql

components/documents/upload-button.tsx

components/documents/upload-dropzone.tsx

app/app/o/[slug]/dashboard/actions.ts

docs/specs/upload-dashboard.md

## 5) OPS-001: cerrar Resend y QA
Objetivo

Dejar el circuito de confirmación por email listo para entorno real y cerrar una batería de QA que valide todo el flujo de Semana 1.

Resultado esperado

Resend configurado correctamente

Supabase Auth usando SMTP propio

plantillas de confirmación alineadas con SSR

Redirect URLs bien configuradas

smoke tests manuales y automatizados básicos

runbook de debugging

Alcance

DNS y dominio de envío

SMTP en Supabase

template de confirm signup

redirect URLs

checklist de QA

runbook de logs

No alcance

campañas de email

branding avanzado

tracking de deliverability complejo

automatizaciones de marketing

Subtareas de implementación

OPS-001.1 Preparar dominio de envío en Resend

Usa subdominio dedicado, por ejemplo auth.convertilabs.com o mail.convertilabs.com. Resend recomienda subdominios para aislar reputación de envío.

Verifica el dominio en Resend.

Añade los registros requeridos. Resend exige SPF y DKIM para verificar dominio; además su documentación recomienda publicar DMARC para mejorar deliverability y cumplir con exigencias modernas de Gmail/Yahoo.

OPS-001.2 Configurar SMTP de Resend en Supabase
Supabase Auth soporta cualquier proveedor SMTP. Para Resend, las credenciales SMTP documentadas son:

host: smtp.resend.com

puertos: 465 o 587 son las opciones razonables

username: resend

password: API key de Resend

En Supabase:

Authentication → Email / SMTP Settings

configurar sender email y sender name

activar custom SMTP

OPS-001.3 Configurar URLs de auth
En Supabase:

Site URL de producción

Redirect URLs para:

local

preview

producción

la ruta de confirmación SSR que decidas

Supabase exige que el redirectTo usado por auth coincida con la lista de Redirect URLs permitidas.

OPS-001.4 Ajustar plantilla de confirmación
Si el flujo es SSR, cambia la plantilla de confirm signup para que apunte a tu ruta de confirmación, por ejemplo:

{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email

Supabase documenta este patrón para flujos server-side con token hash.

OPS-001.5 Checklist de deliverability
Pruebas mínimas:

Gmail

Outlook

un correo en dominio propio

revisar inbox vs spam

revisar From name y From address

revisar que el enlace vuelve a la URL correcta

OPS-001.6 QA manual end-to-end
Checklist de humo:

signup

email recibido

click en confirm link

sesión creada

profiles existente

onboarding de organización

dashboard accesible

upload de documento

documento visible

aislamiento entre orgs

OPS-001.7 QA automatizado
Añade al menos una suite de humo con Playwright o equivalente:

login de usuario confirmado seed

redirect a dashboard

upload falso o mock si no quieres depender de archivos grandes

guard de rutas privadas

Email real puedes dejarlo como prueba manual de staging. Fingir E2E perfecto con correo real desde CI es otra de esas costumbres humanas que se disfrutan hasta que empiezan a fallar aleatoriamente.

OPS-001.8 Runbook de debugging
Si fallan emails o auth:

mirar primero Auth logs de Supabase

si hay error 500 de auth, revisar dependencia externa como DB trigger o SMTP

revisar Postgres logs si sospechas del trigger de auth.users

Supabase indica que problemas de entrega suelen empezar por Auth logs, y que muchos 500 de Auth vienen de dependencias externas como base de datos o SMTP.

Criterios de aceptación

El usuario recibe email de confirmación desde tu dominio.

El enlace aterriza en la ruta correcta y crea sesión.

No hay redirects a localhost ni URLs erróneas.

El flujo completo de Semana 1 pasa en staging.

Hay un checklist reproducible y un runbook básico para incidencias.

Entregables de repo / ops

docs/specs/resend-qa.md

docs/runbooks/auth-email-debugging.md

playwright/smoke/week1-auth-onboarding-upload.spec.ts

variables de entorno documentadas en .env.example

Orden de ejecución recomendado

AUTH-001

ORG-001

DASH-001

DOC-001

OPS-001

Ese orden no es capricho. Es la diferencia entre montar una base sólida y dedicar la semana a perseguir bugs fantasma entre cookies, triggers y rutas privadas.

Definition of Done de Semana 1

Semana 1 queda cerrada cuando puedes demostrar, en staging o producción:

un usuario nuevo se registra;

recibe y confirma el email;

existe en public.profiles;

crea su organización;

entra al dashboard privado de esa org;

sube un documento;

lo ve listado;

otro usuario fuera de la org no puede verlo.