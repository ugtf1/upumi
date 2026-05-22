# Frontend addon: Member Analytics page

Copy these files into your UPUMI Vite/React app.

## Install deps
- `npm i recharts`

## Env
Set `VITE_API_BASE_URL` to your backend, e.g. `https://api.upumi.com`.

## Routing
Add a protected route such as `/member/analytics` that renders `AnalyticsPage`.

Token expectation:
- Store JWT in `localStorage` key `upumi_token`.
