# Prisma → Cloud SQL (Destructive) — Setup

This document lists the repository secrets, IAM roles, and safety notes required to run the destructive GitHub Actions workflow `.github/workflows/prisma-destructive.yml`.

## Required repository secrets
- `GCP_SA_KEY` — JSON service account key with permissions below. Store as a GitHub secret.
- `CLOUD_SQL_CONNECTION_NAME` — Cloud SQL instance connection name in the format `PROJECT:REGION:INSTANCE`.
- `DB_NAME` — Postgres database name used by the app.
- `DB_USER` — Postgres username.
- `DB_PASSWORD` — Postgres password.

## Minimum IAM roles for the service account
- `roles/cloudsql.client` — allow the Cloud SQL Auth Proxy to authenticate and connect.
- `roles/secretmanager.secretAccessor` (optional) — if you plan to fetch DB credentials from Secret Manager.

## What the workflow does
- Authenticates to Google Cloud using `GCP_SA_KEY`.
- Starts the Cloud SQL Auth Proxy connected to `CLOUD_SQL_CONNECTION_NAME`.
- Exports `DATABASE_URL` pointing at `127.0.0.1:5432`.
- Runs `npx prisma db push --force` in `services/upumi-backend` which pushes the local Prisma schema to the database and can alter or drop tables.

## Destructive warning
Running `npx prisma db push --force` is destructive: it can modify or drop existing tables, leading to irreversible data loss. Only run this workflow when you intentionally want to overwrite the target database schema (for example, migrating a fresh dev database). Prefer `npx prisma migrate deploy` for non-destructive migration deployment.

## How to run
1. Add the required secrets to the repository (Settings → Secrets).
2. Trigger the workflow manually from the Actions tab (`Prisma → Cloud SQL (Destructive)`) or push to the `master` branch.

## Notes
- The workflow uses `services/upumi-backend` as the working directory. Adjust the path in the workflow if your Prisma schema or package.json live elsewhere.
- I recommend taking a backup / creating a dump of the target database before running this workflow.
