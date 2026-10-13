# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Genesys Cloud sign-in

Integrated sign-in uses the OAuth 2.0 Authorization Code flow with PKCE (S256)
directly in the browser; it does not use the Genesys platform SDK. Launch the
app with `clientId`, `region`, and `redirectURI` URL parameters (the app also
accepts `redirectUri` and the `gc_`-prefixed Genesys launch parameter names).
The redirect URI must be registered on a public Genesys OAuth client and point
to this app's origin. Use HTTPS outside localhost.

The app keeps the PKCE verifier and state in session storage only for the OAuth
redirect round trip, validates the returned state, and keeps the access token
in memory. The OAuth client needs `users:readonly` and `organizations:readonly`
permissions to load the signed-in user's and organization details.

Standalone email sign-in remains separate. Genesys identity linking to a local
Export Manager account is currently disabled.

## User documentation

The in-app Documentation page displays the guides in `docs/`. Update those
Markdown files when user-facing workflows or behavior change.

## Feedback and issue reports

Use **Report a problem** in the workspace sidebar to open this repository's
GitHub issue form, where you can report a fault or request a feature. Submitting
requires a GitHub account with permission to create issues. Reports are not
sent directly from the app, so no GitHub credentials or tokens are stored in
the browser.

## Supabase backend

The organization-scoped backend is defined in `supabase/migrations` and
`supabase/functions`. The baseline migration is for a **fresh database**; it is
not an incremental migration for the previous schema. It creates:

- approved local accounts and pending standalone access requests;
- organizations and local-user memberships (a global administrator is promoted
  manually and can select any organization);
- verified Genesys integrated-user records, stored with their organization and
  without creating a Supabase Auth account;
- organization-scoped Tooling and Storage configuration RPCs, with credentials
  held in Supabase Vault;
- RLS policies and server-verified Genesys Edge Function access.

Integrated sign-in remains available only when Genesys launch parameters are
present. The `genesys-auth` function validates the Genesys access token against
the region's `/users/me` and `/organizations/me` APIs before recording the
identity. Subsequent integrated configuration calls repeat that validation and
derive the organization from the token; request-supplied organization IDs are
not used for authorization.

Approved local global administrators have an Admin page for organization
directory management, standalone access requests, and local-user management.
Organization IDs are immutable after creation, and an organization cannot be
removed while it has memberships, integrated users, pending requests, or
configuration records. Local-user administration includes approval status,
profile details, organization assignments, and account deletion; global
administrator accounts are protected from deletion in the app.

### Deployment

Install the Supabase CLI, back up any project data that must be retained, and
link this repository to the intended Supabase project:

```powershell
supabase login
supabase link --project-ref <project-ref>
```

The initial migration assumes the target database is empty. If using the
existing project as previously discussed, first confirm the selected project
and its backups, then perform the agreed destructive reset in Supabase. Do not
run the baseline migration against the old populated schema.

After the database is fresh and linked:

```powershell
supabase db push
supabase functions deploy request-access
supabase functions deploy genesys-auth
supabase functions deploy org-data
supabase functions deploy delete-account
supabase functions deploy test-storage-account
```

The Supabase project provides the Edge Function `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values. Keep service-role
keys server-side; never put them in Vite variables or the browser. Genesys
OAuth needs `users:readonly` and `organizations:readonly` scopes for identity
verification.

After the first standalone user has verified their email, promote the intended
first administrator manually in the Supabase SQL editor:

```sql
update public.profiles
set role = 'global_admin', approval_status = 'approved', updated_at = now()
where id = (
  select id from auth.users
  where lower(email) = lower('<admin-email>')
);
```

Standalone email sign-in does not create accounts. New users submit a request
with their home Genesys organization ID; they can verify their email, but RLS
and the workspace route keep them out until an administrator approves the
request. Administrators can approve/reject requests and assign additional
organizations from Settings.

The reset/deploy steps above have **not** been run against any live Supabase
project.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
