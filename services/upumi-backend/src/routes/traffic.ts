
import { FastifyInstance } from "fastify";
import { requireAuth } from '../services/auth.js';

type Provider = "plausible" | "umami" | "none";

function provider(): Provider {
  const p = (process.env.TRAFFIC_PROVIDER ?? "none").toLowerCase();
  if (p === "plausible" || p === "umami") return p;
  return "none";
}

async function plausibleFetch(path: string, query: Record<string,string>) {
  const base = "https://plausible.io/api/v1";
  const url = new URL(base + path);
  for (const [k,v] of Object.entries(query)) url.searchParams.set(k, v);
  const key = process.env.PLAUSIBLE_API_KEY;
  if (!key) throw new Error("PLAUSIBLE_API_KEY not set");
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Plausible API error: ${res.status}`);
  return res.json();
}

async function umamiLogin() {
  const apiUrl = process.env.UMAMI_API_URL;
  const username = process.env.UMAMI_USERNAME;
  const password = process.env.UMAMI_PASSWORD;
  if (!apiUrl || !username || !password) throw new Error("Umami env vars not set");
  const res = await fetch(`${apiUrl.replace(/\/$/,"")}/api/auth/login`, {
    method: "POST",
    headers: { "content-type":"application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error(`Umami login error: ${res.status}`);
  const data:any = await res.json();
  return data?.token ?? data?.accessToken ?? null;
}

async function umamiFetch(path: string, token: string) {
  const apiUrl = process.env.UMAMI_API_URL!;
  const res = await fetch(`${apiUrl.replace(/\/$/,"")}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Umami API error: ${res.status}`);
  return res.json();
}

export async function trafficRoutes(app: FastifyInstance) {
  // Member-only traffic summary (aggregate only)
  app.get("/analytics/traffic", { preHandler: [requireAuth] }, async (req: any) => {
    const period = String(req.query?.period ?? "30d"); // 7d, 30d, 6mo, 12mo (plausible-style)
    const siteId = process.env.TRAFFIC_SITE_ID ?? process.env.PLAUSIBLE_SITE_ID ?? process.env.UMAMI_WEBSITE_ID;

    const p = provider();
    if (p === "none") {
      return {
        provider: "none",
        message: "Traffic provider not configured. Set TRAFFIC_PROVIDER and provider env vars.",
        period,
        kpis: [],
        series: []
      };
    }

    if (!siteId) {
      return { provider: p, message: "Missing TRAFFIC_SITE_ID / PLAUSIBLE_SITE_ID / UMAMI_WEBSITE_ID", period };
    }

    if (p === "plausible") {
      // KPIs
      const agg: any = await plausibleFetch("/stats/aggregate", { site_id: siteId, period, metrics: "visitors,pageviews,visit_duration,bounce_rate" });
      // Timeseries (visitors/pageviews per day)
      const ts: any = await plausibleFetch("/stats/timeseries", { site_id: siteId, period, metrics: "visitors,pageviews" });
      // Top pages
      const pages: any = await plausibleFetch("/stats/breakdown", { site_id: siteId, period, property: "event:page", metrics: "pageviews", limit: "10" });

      return {
        provider: "plausible",
        period,
        kpis: agg?.results ?? {},
        series: ts?.results ?? [],
        topPages: pages?.results ?? []
      };
    }

    // umami
    const token = await umamiLogin();
    const websiteId = siteId;

    const endAt = Date.now();
    const startAt = (() => {
      if (period === "7d") return endAt - 7*24*3600*1000;
      if (period === "30d") return endAt - 30*24*3600*1000;
      if (period === "6mo") return endAt - 183*24*3600*1000;
      return endAt - 365*24*3600*1000;
    })();

    const metrics = await umamiFetch(`/api/websites/${websiteId}/metrics?startAt=${startAt}&endAt=${endAt}`, token);
    const pageviews = await umamiFetch(`/api/websites/${websiteId}/pageviews?startAt=${startAt}&endAt=${endAt}&unit=day`, token);
    const pages = await umamiFetch(`/api/websites/${websiteId}/pages?startAt=${startAt}&endAt=${endAt}&limit=10`, token);

    return {
      provider: "umami",
      period,
      kpis: metrics ?? {},
      series: pageviews ?? [],
      topPages: pages ?? []
    };
  });
}
