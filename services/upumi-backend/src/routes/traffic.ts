import { FastifyInstance } from "fastify";
import { requireAuth } from "../services/auth.js";

type Provider = "plausible" | "umami" | "none";

function getProvider(): Provider {
  const p = (process.env.TRAFFIC_PROVIDER ?? "none").toLowerCase();
  if (p === "plausible" || p === "umami") return p;
  return "none";
}

async function plausibleFetch(path: string, query: Record<string, string>) {
  const base = "https://plausible.io/api/v1";
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

  const key = process.env.PLAUSIBLE_API_KEY;
  if (!key) throw new Error("PLAUSIBLE_API_KEY not set");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Plausible API error: ${res.status}`);
  return res.json() as Promise<any>;
}

async function umamiLogin(): Promise<string> {
  const apiUrl = process.env.UMAMI_API_URL;
  const username = process.env.UMAMI_USERNAME;
  const password = process.env.UMAMI_PASSWORD;

  if (!apiUrl || !username || !password) {
    throw new Error("Umami env vars not set (UMAMI_API_URL/UMAMI_USERNAME/UMAMI_PASSWORD)");
  }

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error(`Umami login error: ${res.status}`);

  const data: any = await res.json();
  const token = data?.token ?? data?.accessToken ?? null;
  if (!token) throw new Error("Umami login succeeded but no token returned");
  return token;
}

async function umamiFetch(path: string, token: string) {
  const apiUrl = process.env.UMAMI_API_URL!;
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Umami API error: ${res.status}`);
  return res.json() as Promise<any>;
}

export async function trafficRoutes(app: FastifyInstance) {
  /**
   * Final URL (with server.ts prefix): GET /api/analytics/traffic?period=30d
   * Member-only. Returns aggregate traffic only.
   */
  app.get(
    "/traffic",
    { preHandler: [requireAuth] },
    async (req: any) => {
      const period = String(req.query?.period ?? "30d"); // 7d, 30d, 6mo, 12mo
      const siteId =
        process.env.TRAFFIC_SITE_ID ??
        process.env.PLAUSIBLE_SITE_ID ??
        process.env.UMAMI_WEBSITE_ID;

      const p = getProvider();

      if (p === "none") {
        return {
          provider: "none",
          message:
            "Traffic provider not configured. Set TRAFFIC_PROVIDER and provider env vars.",
          period,
          kpis: {},
          series: [],
          topPages: [],
        };
      }

      if (!siteId) {
        return {
          provider: p,
          message:
            "Missing TRAFFIC_SITE_ID / PLAUSIBLE_SITE_ID / UMAMI_WEBSITE_ID",
          period,
          kpis: {},
          series: [],
          topPages: [],
        };
      }

      if (p === "plausible") {
        const agg: any = await plausibleFetch("/stats/aggregate", {
          site_id: siteId,
          period,
          metrics: "visitors,pageviews,visit_duration,bounce_rate",
        });

        const ts: any = await plausibleFetch("/stats/timeseries", {
          site_id: siteId,
          period,
          metrics: "visitors,pageviews",
        });

        const pages: any = await plausibleFetch("/stats/breakdown", {
          site_id: siteId,
          period,
          property: "event:page",
          metrics: "pageviews",
          limit: "10",
        });

        return {
          provider: "plausible",
          period,
          kpis: agg?.results ?? {},
          series: ts?.results ?? [],
          topPages: pages?.results ?? [],
        };
      }

      // umami
      const token = await umamiLogin();
      const websiteId = siteId;

      const endAt = Date.now();
      const startAt =
        period === "7d"
          ? endAt - 7 * 24 * 3600 * 1000
          : period === "30d"
          ? endAt - 30 * 24 * 3600 * 1000
          : period === "6mo"
          ? endAt - 183 * 24 * 3600 * 1000
          : endAt - 365 * 24 * 3600 * 1000;

      const metrics = await umamiFetch(
        `/api/websites/${websiteId}/metrics?startAt=${startAt}&endAt=${endAt}`,
        token
      );
      const pageviews = await umamiFetch(
        `/api/websites/${websiteId}/pageviews?startAt=${startAt}&endAt=${endAt}&unit=day`,
        token
      );
      const pages = await umamiFetch(
        `/api/websites/${websiteId}/pages?startAt=${startAt}&endAt=${endAt}&limit=10`,
        token
      );

      return {
        provider: "umami",
        period,
        kpis: metrics ?? {},
        series: pageviews ?? [],
        topPages: pages ?? [],
      };
    }
  );
}
