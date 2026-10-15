# Genesys Cloud Export Manager

A Vite, React and TypeScript application for managing organization-scoped configuration and access for Genesys Cloud export workflows.

## Current release scope

The application includes Genesys Cloud integrated sign-in, standalone email sign-in, organization-scoped configuration, storage-account connection testing, and administration features.

**Export execution is not yet fully implemented.** The Overview, Export History and Resources screens still contain sample data or placeholders. Do not represent those areas as live export functionality until their backend integration has been implemented and tested.

## Prerequisites

- Node.js and npm
- A configured Supabase project for the required backend features
- A Genesys Cloud OAuth client for integrated sign-in
- A Cloudflare Pages project for hosting the frontend

## Local development

Install dependencies:

```powershell
npm ci
```

Create your local environment file:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and supply the values for your Supabase project.

Start the development server:

```powershell
npm run dev
```

## Environment configuration

The frontend uses the following Vite environment variables:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key, or the project's legacy anon key |

Vite variables are included in the built frontend. Never put a Supabase service-role key, database password, or other server-side secret in a `VITE_` variable.

Configure server-side secrets in Supabase, not in the frontend environment.

## Build and quality checks

Run these checks before committing release changes:

```powershell
npm run lint
npm run build
```

To inspect the production build locally:

```powershell
npm run preview
```

The production build is written to `dist/`.

## Genesys Cloud integrated sign-in

Integrated sign-in uses the OAuth 2.0 Authorization Code flow with PKCE (S256) directly in the browser.

The application accepts the Genesys launch parameters `clientId`, `region` and `redirectURI`, along with supported alternative parameter names. The redirect URI must match a URI registered on the Genesys OAuth client. Use HTTPS outside localhost.

The application stores the PKCE verifier and state in session storage for the redirect round trip and keeps the access token in memory. The OAuth client needs the `users:readonly` and `organizations:readonly` permissions for identity verification.

Integrated Genesys identity is separate from standalone Supabase email authentication.

## Supabase backend

Database migrations are stored in `supabase/migrations/`. Edge Functions are stored in `supabase/functions/`.

The current baseline migration is intended for a **fresh database**. It is not an incremental migration for the previous schema.

### Database deployment safeguards

Before applying migrations to any remote project:

1. Confirm the exact Supabase project and environment.
2. Back up any data that must be retained.
3. Inspect the remote migration history and compare the remote schema with the repository migrations.
4. Test the migrations against a separate staging database.
5. Review the pending migration set using `supabase db push --dry-run`.
6. Apply migrations only after the target schema, migration history, and proposed changes have been reconciled and approved.

Do not blindly run `supabase db push` against an existing project. Never perform a destructive database reset on a shared or production database as part of routine deployment.

### Staging deployment workflow

After confirming the target is a disposable or correctly prepared staging project:

```powershell
supabase login
supabase link --project-ref <staging-project-ref>
supabase migration list
supabase db push --dry-run
```

Review the dry-run output before deciding whether to apply the migrations. Do not proceed if unexpected migrations are pending or the remote schema is not compatible with the repository baseline.

Deploy the Edge Functions after the database and required server-side configuration have been validated:

```powershell
supabase functions deploy request-access
supabase functions deploy genesys-auth
supabase functions deploy org-data
supabase functions deploy delete-account
supabase functions deploy test-storage-account
```

These commands are examples for a validated staging deployment, not approval to run against production.

### Edge Function authentication

Several Edge Functions have Supabase gateway JWT verification disabled and perform their own authentication checks. This is security-sensitive and intentional in the current architecture, which supports both Genesys bearer tokens and Supabase-authenticated users.

Do not change the `verify_jwt` settings without reviewing the individual function's authentication and authorization flow. Test unauthenticated requests, invalid credentials, cross-organization access, and privileged operations before production release.

Supabase service-role credentials must remain server-side.

## Cloudflare Pages

The frontend production build uses:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the appropriate Cloudflare Pages environment. Use separate values for preview/staging and production as applicable.

React Router deep links must also be tested on the deployed site, including refreshing a nested route directly.

## User documentation

The in-app Documentation page displays the Markdown guides in `docs/`. Update those files when user-facing workflows or application behaviour change.

## Feedback and issue reports

Use **Report a problem** in the workspace sidebar to open the repository's GitHub issue form. Submitting an issue requires a GitHub account with the required repository permissions.