
import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "./api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";

type MeResponse = {
  linked: boolean;
  message?: string;
  member?: any;
  myFinancial?: any;
  duesSeries?: { month: string; present: boolean | null; duesPaid: number }[];
};

type SummaryResponse = {
  year: number;
  counts: any;
  duesByMonth: { month: string; totalDuesPaid: number; records: number }[];
  financialTotals: any;
  totalsKpis: { label: string; value: number }[];
};

type TrafficResponse = {
  provider: string;
  message?: string;
  period: string;
  kpis?: any;
  series?: any[];
  topPages?: any[];
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl shadow-sm border border-gray-200 p-4 bg-white">
      <div className="text-sm font-semibold text-gray-700 mb-2">{title}</div>
      {children}
    </div>
  );
}

function KpiGrid({ kpis }: { kpis: { label: string; value: any }[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-2xl border border-gray-200 p-3 bg-white">
          <div className="text-xs text-gray-500">{k.label}</div>
          <div className="text-xl font-semibold text-gray-900">{typeof k.value === "number" ? k.value.toLocaleString() : String(k.value)}</div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [period, setPeriod] = useState<string>("30d");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [traffic, setTraffic] = useState<TrafficResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const [meRes, sumRes, trafRes] = await Promise.all([
          apiGet<MeResponse>(`/analytics/me?year=${year}`),
          apiGet<SummaryResponse>(`/analytics/summary?year=${year}`),
          apiGet<TrafficResponse>(`/analytics/traffic?period=${period}`)
        ]);
        setMe(meRes);
        setSummary(sumRes);
        setTraffic(trafRes);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load analytics");
      }
    })();
  }, [year, period]);

  const statusPie = useMemo(() => {
    const obj = summary?.counts?.status ?? {};
    return Object.entries(obj).map(([name, value]) => ({ name, value: Number(value) }));
  }, [summary]);

  const trafficSeries = useMemo(() => {
    // plausible timeseries: [{date, visitors, pageviews}]
    // umami pageviews: [{x: timestamp, y: pageviews}] or similar; normalize lightly
    const s = traffic?.series ?? [];
    if (traffic?.provider === "umami") {
      return s.map((d: any) => ({
        date: d?.x ? new Date(d.x).toLocaleDateString() : String(d?.t ?? ""),
        visitors: Number(d?.visitors ?? d?.y ?? 0),
        pageviews: Number(d?.pageviews ?? d?.y ?? 0)
      }));
    }
    return s.map((d: any) => ({
      date: d?.date ?? d?.time ?? "",
      visitors: Number(d?.visitors ?? 0),
      pageviews: Number(d?.pageviews ?? 0)
    }));
  }, [traffic]);

  const trafficKpis = useMemo(() => {
    if (!traffic) return [];
    if (traffic.provider === "plausible" && traffic.kpis) {
      return [
        { label: "Visitors", value: traffic.kpis.visitors?.value ?? 0 },
        { label: "Pageviews", value: traffic.kpis.pageviews?.value ?? 0 },
        { label: "Bounce rate", value: traffic.kpis.bounce_rate?.value ?? 0 },
        { label: "Visit duration (s)", value: traffic.kpis.visit_duration?.value ?? 0 }
      ];
    }
    if (traffic.provider === "umami" && traffic.kpis) {
      return [
        { label: "Pageviews", value: traffic.kpis.pageviews?.value ?? traffic.kpis.pageviews ?? 0 },
        { label: "Visitors", value: traffic.kpis.visitors?.value ?? traffic.kpis.visitors ?? 0 },
        { label: "Visits", value: traffic.kpis.visits?.value ?? traffic.kpis.visits ?? 0 },
        { label: "Bounces", value: traffic.kpis.bounces?.value ?? traffic.kpis.bounces ?? 0 }
      ];
    }
    return [];
  }, [traffic]);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <div className="text-2xl font-semibold text-gray-900">Member Analytics</div>
          <div className="text-sm text-gray-600">Private dashboard (requires login)</div>
        </div>
        <div className="flex gap-2">
          <select className="border rounded-xl p-2 bg-white" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="border rounded-xl p-2 bg-white" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {["7d","30d","6mo","12mo"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 mb-4">{err}</div>}

      {/* KPI strip */}
      {summary?.totalsKpis && <KpiGrid kpis={summary.totalsKpis} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Card title="My membership status">
          {!me?.linked ? (
            <div className="text-sm text-gray-700">{me?.message ?? "Not linked yet."}</div>
          ) : (
            <div className="text-sm text-gray-800 space-y-1">
              <div><span className="text-gray-500">Name:</span> {me.member.firstName} {me.member.lastName}</div>
              <div><span className="text-gray-500">Status:</span> {me.member.status ?? "—"}</div>
              <div><span className="text-gray-500">Good standing:</span> {me.member.goodStanding ?? "—"}</div>
              <div><span className="text-gray-500">Financial good standing:</span> {me.member.financialGoodStanding ?? "—"}</div>
              <div><span className="text-gray-500">% Attendance:</span> {me.member.attendancePct ?? "—"}</div>
            </div>
          )}
        </Card>

        <Card title={`My ${year} financial snapshot`}>
          {!me?.linked ? (
            <div className="text-sm text-gray-700">—</div>
          ) : (
            <div className="text-sm text-gray-800 space-y-1">
              <div><span className="text-gray-500">Dues paid:</span> {Number(me.myFinancial.duesPaidYear ?? 0).toLocaleString()}</div>
              <div><span className="text-gray-500">Balance:</span> {Number(me.myFinancial.balanceYear ?? 0).toLocaleString()}</div>
              <div><span className="text-gray-500">Hosting:</span> {Number(me.myFinancial.hosting ?? 0).toLocaleString()}</div>
              <div><span className="text-gray-500">Levies:</span> {Number(me.myFinancial.levies ?? 0).toLocaleString()}</div>
              <div><span className="text-gray-500">Fundraiser raffle:</span> {Number(me.myFinancial.raffleUpumi ?? 0).toLocaleString()}</div>
            </div>
          )}
        </Card>

        <Card title="Membership mix (by status)">
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={85} />
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title={`${year} dues collected by month`}>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={summary?.duesByMonth ?? []}>
                <CartesianGrid />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="totalDuesPaid" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="My dues history (month-by-month)">
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={me?.duesSeries ?? []}>
                <CartesianGrid />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="duesPaid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card title={`Website traffic (${period})`}>
          {traffic?.provider === "none" ? (
            <div className="text-sm text-gray-700">
              {traffic.message ?? "Traffic provider not configured."}
              <div className="text-xs text-gray-500 mt-2">
                Tip: Plausible or Umami works great for private dashboards.
              </div>
            </div>
          ) : (
            <>
              {trafficKpis.length > 0 && <KpiGrid kpis={trafficKpis} />}
              <div className="mt-3" style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={trafficSeries}>
                    <CartesianGrid />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="visitors" />
                    <Line type="monotone" dataKey="pageviews" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>

        <Card title="Top pages (traffic)">
          {traffic?.topPages?.length ? (
            <div className="text-sm text-gray-800">
              <div className="space-y-2">
                {traffic.topPages.map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-4">
                    <div className="truncate">{p.page ?? p.name ?? p.url ?? "—"}</div>
                    <div className="text-gray-500 tabular-nums">
                      {Number(p.pageviews ?? p.value ?? p.y ?? 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700">—</div>
          )}
        </Card>
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Notes: Org-level tiles are aggregates only (no names/emails). Your personal details come from your linked member record.
      </div>
    </div>
  );
}
