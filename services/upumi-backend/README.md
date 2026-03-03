# UPUMI Backend (Admin + Member Accounts)

This backend adds:
- Postgres database storage for the UPUMI workbook CSV
- User accounts (JWT auth)
- Role-based access control:
  - **ADMIN**: can import/list/link all member records
  - **USER**: can only access their own record + dues history

## Tech choices (fast + simple)
- Fastify (high-perf Node API)
- Prisma ORM + PostgreSQL
- JWT(JSON Web Token) auth
- CSV import script (idempotent upserts)

## Quickstart (local)

```bash
cd services/upumi-backend
cp .env.example .env
docker compose up -d
npm i
npx prisma migrate dev --name init
npm run import:members   # set CSV_PATH env if needed
npm run dev
```

### Create first admin (one-time)

Set `ADMIN_BOOTSTRAP_SECRET` in `.env`, then:

```bash
curl -X POST http://localhost:8080/api/auth/bootstrap-admin \
  -H 'content-type: application/json' \
  -H 'x-admin-bootstrap: YOUR_SECRET' \
  -d '{"email":"admin@upumi.com","password":"a-very-strong-password"}'
```

After you have an admin, disable/remove the route (recommended).

## Frontend integration (Vite SPA)

- Call `POST /api/auth/register` / `POST /api/auth/login` to obtain a bearer token.
- Store token in memory or secure storage.
- Send `Authorization: Bearer <token>` on calls.
- Use `GET /api/me` for membership status dashboard.
- Admin UI can call `GET /api/admin/members`, `POST /api/admin/import-members`.
- Admin UI can also call `POST /api/admin/sync-google-sheet` to import latest Google Sheet directly.

## Security notes (production)
- Put the API behind HTTPS.
- Set `CORS_ORIGIN` to your deployed frontend origin (e.g. https://upumi.com).
- Rotate `JWT_SECRET`.
- Consider adding refresh tokens + HttpOnly cookies if you want more protection against XSS.


## Analytics & Traffic

### Member analytics
- `GET /api/analytics/me?year=2025` (JWT required) — your membership + dues-by-month
- `GET /api/analytics/summary?year=2025` (JWT required) — org-level aggregates (no PII)

### Website traffic analytics
- `GET /api/analytics/traffic?period=30d` (JWT required)

Configure in `.env`:
- `TRAFFIC_PROVIDER=plausible` or `umami`
- For Plausible: `PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`
- For Umami: `UMAMI_API_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, `UMAMI_WEBSITE_ID`

If not configured, the endpoint returns a friendly message and empty series.

## Fast deploy (single service)

This backend can serve the frontend build from `public/`, so deploy it as one service.

### Option A: Docker host (fastest if supported)

- Build from `services/upumi-backend/Dockerfile`
- Expose port `8080` (or set `PORT`)
- Run DB migrations once per deploy:
  - command: `npx prisma migrate deploy`
- Start command:
  - `node dist/server.js`

The provided Dockerfile now includes `public/` so the SPA is served with the API.

### Option B: Node host (Render/Railway/Fly machine)

- Build command: `npm install && npm run build`
- Start command: `npm run start:prod`
- Health check path: `/health`

Required env vars:
- `DATABASE_URL` (Postgres)
- `JWT_SECRET` (strong random string)
- `CORS_ORIGIN` (your frontend origin, if not same-origin)
- `ADMIN_BOOTSTRAP_SECRET` (temporary; remove after first admin is created)

Optional sync env vars:
- `GOOGLE_SHEET_URL` (your normal Sheet URL like `https://docs.google.com/spreadsheets/d/.../edit`)
- or `GOOGLE_SHEET_CSV_URL` (direct CSV export URL)
- `GOOGLE_SHEET_GID` (sheet tab gid, default `0`)
- `GOOGLE_SHEET_YEAR` (import year, e.g. `2026`)
- `SCHEDULER_IMPORT_SECRET` (shared secret header for cron endpoint)

Recommended first deploy sequence:
1. Deploy backend with Postgres and env vars.
2. Confirm `GET /health` returns `{ "ok": true }`.
3. Create admin via `POST /api/auth/bootstrap-admin`.
4. Import members with `npm run import:members` (or admin API import).
5. Remove/rotate `ADMIN_BOOTSTRAP_SECRET`.

## Google Sheets Sync (manual + daily)

### Manual sync (from Admin UI)
- Use the **Sync Google Sheet** button in Admin.
- It calls `POST /api/admin/sync-google-sheet` with current year.

### Manual sync (API)
```bash
curl -X POST "$API_URL/api/admin/sync-google-sheet" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "content-type: application/json" \
  -d '{"year":2026}'
```

### Daily auto sync (Cloud Scheduler)
Use the protected cron endpoint: `POST /api/admin/cron/sync-google-sheet`

1. Set Secret Manager secret for `SCHEDULER_IMPORT_SECRET`.
2. Add env vars to Cloud Run service:
   - `GOOGLE_SHEET_URL` (or `GOOGLE_SHEET_CSV_URL`)
   - `GOOGLE_SHEET_GID`
   - `GOOGLE_SHEET_YEAR`
   - `SCHEDULER_IMPORT_SECRET`
3. Create scheduler job (replace placeholders):
```bash
gcloud scheduler jobs create http upumi-sheet-sync \
  --location=us-east1 \
  --schedule="0 6 * * *" \
  --http-method=POST \
  --uri="https://<API_URL>/api/admin/cron/sync-google-sheet" \
  --headers="x-scheduler-secret=<SCHEDULER_IMPORT_SECRET>" \
  --oidc-service-account-email="<SCHEDULER_SA_EMAIL>" \
  --oidc-token-audience="https://<API_URL>"
```

Notes:
- If your Cloud Run API is private (recommended), the scheduler service account needs `roles/run.invoker`.
- If Google Sheet fetch returns 403/404, ensure the sheet is shared so the service can export CSV.
