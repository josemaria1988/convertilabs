# Convertilabs Auth Signup Flow

**Status:** Implemented v0.2

## Goal

Provide the first production-shaped auth flow for the web app using Supabase Auth SSR without exposing server-side secrets in the browser.

## Scope

This delivery covers:
- public signup page
- backend signup and login endpoints
- shared validation rules
- SSR session persistence in cookies
- `/auth/confirm` for email confirmation
- `/logout` route
- `public.profiles` mirror + backfill

This delivery does not yet cover:
- password reset
- invite-only organization onboarding
- social login
- MFA

## Implemented Flow

1. User opens `/signup`.
2. Frontend validates `fullName`, `email`, and `password`.
3. Frontend sends `POST /api/v1/auth/signup`.
4. Backend validates again.
5. Backend calls `supabase.auth.signUp()` with:
   - email
   - password
   - `full_name` in user metadata
   - `emailRedirectTo` pointing to `/auth/confirm`
6. If email confirmation is active, the API returns the "check email" state.
7. If Supabase returns a session immediately, the API redirects the client to onboarding or to `/app/o/[slug]/dashboard`.
8. `/login` calls `POST /api/v1/auth/login`, persists the SSR session cookie and redirects server-driven to onboarding or to `/app/o/[slug]/dashboard`.
9. `/auth/confirm` exchanges `token_hash` for a session and lands on the same authenticated destination.
10. `/logout` clears the SSR session and returns the user to `/login`.

## Security Decisions

### 1. Public signup uses `signUp`, not `auth.admin.createUser`
Reason:
- public signup should not rely on service-role privileges
- it reduces blast radius if the endpoint is abused
- it matches the product architecture where web app auth uses Supabase sessions

### 2. Duplicate-email responses stay generic
Reason:
- this reduces trivial account enumeration
- the API should not confirm whether an email already exists

### 3. Password policy is stricter than the bare provider minimum
Current rule:
- minimum 12 characters
- must include letters
- must include numbers

Reason:
- better default security without forcing complex symbol rules that damage usability

### 4. Validation runs on both client and server
Reason:
- client validation improves usability
- server validation remains authoritative

### 5. Only public Supabase keys are reachable from the browser
Reason:
- anon/public values may be exposed client-side
- service-role and JWT secrets stay server-only in `.env`

### 6. Session handling uses `@supabase/ssr`
Reason:
- Supabase deprecated the old auth helpers path
- the app needs cookie-based SSR auth for protected routes
- middleware refresh is required because Server Components cannot write cookies by themselves

## Architecture Decisions Taken Because Specs Were Missing

The existing docs defined:
- Supabase Auth for app sessions
- modular monolith boundaries
- `profiles` as the application mirror of `auth.users`

The docs did not yet define:
- the signup endpoint
- the login endpoint
- password policy
- public vs admin creation strategy
- duplicate-email response behavior
- the concrete SSR confirm route

Chosen implementation:
- endpoint: `POST /api/v1/auth/signup`
- endpoint: `POST /api/v1/auth/login`
- strategy: backend proxy to `supabase.auth.signUp()`
- login strategy: backend proxy to `supabase.auth.signInWithPassword()`
- redirect after email confirmation: `/auth/confirm`
- `full_name` and `avatar_url` live in auth metadata for profile mirror creation
- `public.profiles` is backfilled for pre-existing `auth.users`

## Follow-Ups

- add password reset
- add invite-based organization membership onboarding
- add rate limiting at the edge or proxy layer
