# Genesys Cloud Export Manager — Dashboard Patch

This patch replaces three frontend files with an authenticated dashboard shell using the existing Genesys React Components theme and Genesys Dev Icon Pack.

## Apply

Extract this ZIP into the project root (`C:\gcti\_working\genesys-cloud-export-manager`) and allow it to overwrite:

- `src/App.tsx`
- `src/App.scss`
- `src/index.css`

No dependency changes are required; the package versions are already in `package.json`.

## Verify

From the project root:

```powershell
npm run build
npm run lint
npm run dev
```

Launch with the configured URL parameters as before. After PKCE succeeds and `GET /api/v2/users/me` succeeds, the app transitions to the dashboard.

## Current scope

- Authentication and configuration remain URL-driven as before.
- Dashboard, navigation, resources view, export history and settings view are implemented.
- Dashboard metrics and history are clearly marked demo data.
- Terraform + Archy is the primary workflow in the UI.
- Direct API export categories are placeholders only.
- No Terraform or Archy process is executed by this patch.
