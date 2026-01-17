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
cd backend
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
curl -X POST http://localhost:8080/auth/bootstrap-admin   -H 'content-type: application/json'   -H 'x-admin-bootstrap: YOUR_SECRET'   -d '{"email":"admin@upumi.com","password":"a-very-strong-password"}'
```

After you have an admin, disable/remove the route (recommended).

## Frontend integration (Vite SPA)

- Call `POST /auth/register` / `POST /auth/login` to obtain a bearer token.
- Store token in memory or secure storage.
- Send `Authorization: Bearer <token>` on calls.
- Use `GET /me` for membership status dashboard.
- Admin UI can call `GET /admin/members`, `POST /admin/import-members`.

## Security notes (production)
- Put the API behind HTTPS.
- Set `CORS_ORIGIN` to your deployed frontend origin (e.g. https://upumi.com).
- Rotate `JWT_SECRET`.
- Consider adding refresh tokens + HttpOnly cookies if you want more protection against XSS.


## Analytics & Traffic

### Member analytics
- `GET /analytics/me?year=2025` (JWT required) — your membership + dues-by-month
- `GET /analytics/summary?year=2025` (JWT required) — org-level aggregates (no PII)

### Website traffic analytics
- `GET /analytics/traffic?period=30d` (JWT required)

Configure in `.env`:
- `TRAFFIC_PROVIDER=plausible` or `umami`
- For Plausible: `PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`
- For Umami: `UMAMI_API_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD`, `UMAMI_WEBSITE_ID`

If not configured, the endpoint returns a friendly message and empty series.
