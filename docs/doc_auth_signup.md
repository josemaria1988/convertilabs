# Convertilabs Auth Signup Flow

**Status:** Implemented draft v0.1

## Goal

Provide a first production-shaped user creation flow for the web app using Supabase Auth without exposing server-side secrets in the browser.

## Scope

This delivery covers:
- public signup page
- backend signup endpoint
- shared validation rules
- Supabase profile-sync migration draft

This delivery does not yet cover:
- interactive login
- session persistence in cookies
- password reset
- invite-only organization onboarding

## Implemented Flow

1. User opens `/signup`.
2. Frontend validates `fullName`, `email`, and `password`.
3. Frontend sends `POST /api/v1/auth/signup`.
4. Backend validates again.
5. Backend calls `supabase.auth.signUp()` with:
   - email
   - password
   - `full_name` in user metadata
   - `emailRedirectTo` pointing to `/login?signup=confirmed`
6. API returns a generic success payload when signup is accepted.

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

## Architecture Decisions Taken Because Specs Were Missing

The existing docs defined:
- Supabase Auth for app sessions
- modular monolith boundaries
- `profiles` as the application mirror of `auth.users`

The docs did not yet define:
- the signup endpoint
- password policy
- public vs admin creation strategy
- duplicate-email response behavior

Chosen implementation:
- endpoint: `POST /api/v1/auth/signup`
- strategy: backend proxy to `supabase.auth.signUp()`
- redirect after email confirmation: `/login?signup=confirmed`
- `full_name` stored in auth metadata for later profile sync

## Follow-Ups

- implement real login and session handling
- add password reset
- add invite-based organization membership onboarding
- apply the SQL migration in Supabase so `public.profiles` mirrors `auth.users`
- add rate limiting at the edge or proxy layer
