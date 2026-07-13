# Boutinly CRM

Boutinly CRM is a B2B customer relationship management product. The repository now contains a React frontend and a production-shaped Node/Express API foundation.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` or export the values from `.env.example`.

3. Run the frontend:

   ```bash
   npm run dev:web
   ```

4. Run the API:

   ```bash
   npm run dev:api
   ```

## Verification

```bash
npm run check
```

This runs TypeScript checks, API tests, frontend build, and API build.

## Architecture

- Frontend: Vite, React, TypeScript, Tailwind.
- API: Express, Helmet, CORS allow-list, structured logging, Zod validation, HMAC JWT sessions, RBAC middleware.
- Persistence target: PostgreSQL. See `migrations/001_enterprise_core.sql`.
- Current local API repository: in-memory seeded data for development and tests.

## Production Notes

The old browser-only CRM prototype has been kept while the backend foundation is introduced. Before production launch, move all CRM reads/writes to the API and replace the in-memory repository with PostgreSQL.

See `docs/ENTERPRISE_READINESS_PLAN.md` for the complete production plan and gates.
