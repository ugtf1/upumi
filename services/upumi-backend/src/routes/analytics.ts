
import { FastifyInstance } from "fastify";
import { prisma } from "../services/prisma";
import { requireAuth } from "../services/auth";
import { Decimal } from "@prisma/client/runtime/library";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,]/g, "").trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma Decimal
  if (typeof v === "object" && (v as any).toNumber) {
    try { return (v as any).toNumber(); } catch { return 0; }
  }
  return 0;
}

function pickRaw(raw: any, keys: string[]) {
  const out: Record<string, any> = {};
  for (const k of keys) out[k] = raw?.[k];
  return out;
}

export async function analyticsRoutes(app: FastifyInstance) {
  // Member-only: my analytics
  app.get("/analytics/me", { preHandler: [requireAuth] }, async (req: any) => {
    const year = Number(req.query?.year ?? new Date().getFullYear());
    const userId = req.user.sub as string;

    const member = await prisma.memberRecord.findFirst({
      where: { userId },
      include: {
        monthlyDues: { where: { year }, orderBy: { month: "asc" } }
      }
    });

    if (!member) {
      return { linked: false, message: "No membership record linked to this account yet. Please contact an admin." };
    }

    const raw: any = member.rawJson ?? {};

    const myFinancial = {
      year,
      duesPaidYear: toNumber(raw[`${year} dues paid`]) || toNumber(raw[`${year} dues paid `]),
      balanceYear: toNumber(raw[`${year} balance`]),
      balances: {
        "2025": toNumber(raw["2025 balance"]),
        "2024": toNumber(raw["2024 balance"]),
        "2023": toNumber(raw["2023 balance"]),
        "2022": toNumber(raw["2022 balance"]),
        "2021": toNumber(raw["2021 balance2"]),
        "2020": toNumber(raw["2020 balance"]),
        "2019": toNumber(raw["2019 balance"]),
        "2018": toNumber(raw["2018 balance"]),
      },
      levies: toNumber(raw["Levies"]),
      hosting: toNumber(raw["Hosting"]),
      raffleUpumi: toNumber(raw["Raffle tix UPUMI fundraiser"]),
      raffleUpua: toNumber(raw["Raffle tix UPUA convention"]),
      ssw: toNumber(raw["SSW contribution"]),
      anambra: toNumber(raw["Anambra contribution"]),
      upua25: toNumber(raw["upua 25 raffle"]),
      wrapper: {
        type: raw["Wrapper type"] ?? null,
        ordered: raw["Wrapper ordered"] ?? null,
        payment: raw["Wrapper payment"] ?? null,
      }
    };

    const duesSeries = MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const md = member.monthlyDues.find(d => d.month === m);
      return {
        month: name,
        present: md?.present ?? null,
        duesPaid: md?.duesPaid ? (md.duesPaid as any).toNumber?.() ?? Number(md.duesPaid) : 0
      };
    });

    return {
      linked: true,
      member: {
        status: member.status,
        firstName: member.firstName,
        lastName: member.lastName,
        joined: member.joined,
        goodStanding: member.goodStanding,
        financialGoodStanding: member.financialGoodStanding,
        attendancePct: member.attendancePct,
        voter: member.voter,
        insurance: member.insurance,
        email: member.email
      },
      myFinancial,
      duesSeries
    };
  });

  // Member-only: org summary (aggregates only; no PII)
  app.get("/analytics/summary", { preHandler: [requireAuth] }, async (req: any) => {
    const year = Number(req.query?.year ?? new Date().getFullYear());

    const duesAgg = await prisma.monthlyDue.groupBy({
      by: ["month"],
      where: { year },
      _sum: { duesPaid: true },
      _count: { _all: true }
    });

    const memberRows = await prisma.memberRecord.findMany({
      select: { status: true, goodStanding: true, financialGoodStanding: true, rawJson: true }
    });

    const counts = {
      totalMembers: memberRows.length,
      status: {} as Record<string, number>,
      goodStanding: { yes: 0, no: 0, unknown: 0 },
      financialGoodStanding: { yes: 0, no: 0, unknown: 0 }
    };

    const financialTotals = {
      levies: 0,
      hosting: 0,
      raffleUpumi: 0,
      raffleUpua: 0,
      ssw: 0,
      anambra: 0,
      upua25: 0,
      duesPaidYear: 0,
      balanceYear: 0
    };

    for (const r of memberRows) {
      const s = (r.status ?? "Unknown").trim();
      counts.status[s] = (counts.status[s] ?? 0) + 1;

      const gs = (r.goodStanding ?? "Unknown").toLowerCase();
      if (gs.startsWith("y")) counts.goodStanding.yes++;
      else if (gs.startsWith("n")) counts.goodStanding.no++;
      else counts.goodStanding.unknown++;

      const fgs = (r.financialGoodStanding ?? "Unknown").toLowerCase();
      if (fgs.startsWith("y")) counts.financialGoodStanding.yes++;
      else if (fgs.startsWith("n")) counts.financialGoodStanding.no++;
      else counts.financialGoodStanding.unknown++;

      const raw:any = r.rawJson ?? {};
      financialTotals.levies += toNumber(raw["Levies"]);
      financialTotals.hosting += toNumber(raw["Hosting"]);
      financialTotals.raffleUpumi += toNumber(raw["Raffle tix UPUMI fundraiser"]);
      financialTotals.raffleUpua += toNumber(raw["Raffle tix UPUA convention"]);
      financialTotals.ssw += toNumber(raw["SSW contribution"]);
      financialTotals.anambra += toNumber(raw["Anambra contribution"]);
      financialTotals.upua25 += toNumber(raw["upua 25 raffle"]);
      financialTotals.duesPaidYear += toNumber(raw[`${year} dues paid`]) || toNumber(raw[`${year} dues paid `]);
      financialTotals.balanceYear += toNumber(raw[`${year} balance`]);
    }

    const duesByMonth = MONTH_NAMES.map((name, idx) => {
      const m = idx + 1;
      const found = duesAgg.find(a => a.month === m);
      const sum = found?._sum?.duesPaid as any;
      const total = sum ? (sum.toNumber?.() ?? Number(sum)) : 0;
      return {
        month: name,
        totalDuesPaid: total,
        records: found?._count?._all ?? 0
      };
    });

    const totalsKpis = [
      { label: "Total members", value: counts.totalMembers },
      { label: "Good standing (Yes)", value: counts.goodStanding.yes },
      { label: "Financial good standing (Yes)", value: counts.financialGoodStanding.yes },
      { label: `${year} dues paid (sum)`, value: financialTotals.duesPaidYear },
      { label: `${year} balance (sum)`, value: financialTotals.balanceYear },
      { label: "Hosting (sum)", value: financialTotals.hosting },
      { label: "Levies (sum)", value: financialTotals.levies },
      { label: "Fundraiser raffle (sum)", value: financialTotals.raffleUpumi },
    ];

    return {
      year,
      counts,
      duesByMonth,
      financialTotals,
      totalsKpis
    };
  });
}
