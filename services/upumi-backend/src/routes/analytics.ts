import { FastifyInstance } from "fastify";
import { prisma } from "../services/prisma.js";
import { requireAuth } from "../services/auth.js";

type RawRow = Record<string, any>;

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLookup: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function toInt(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function decimalToNumber(v: any): number | null {
  if (v == null) return null;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : null;
}

function moneyFromCell(v: any): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s.toLowerCase() === "na") return null;
  const cleaned = s.replace(/\$/g, "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function strCell(v: any): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function normalizeRowType(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

function parseHostingPeriod(hosting: string | null | undefined): { label: string; year: number; month: number } | null {
  const s = String(hosting ?? "").trim();
  if (!s) return null;
  const m = s.match(/([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = monthLookup[m[1].toLowerCase()];
  const year = Number(m[2]);
  if (!month || !Number.isFinite(year)) return null;
  return { label: `${monthNames[month - 1]} ${year}`, month, year };
}

function monthlyDuesColumnKey(month: number): string {
  const label = monthNames[Math.max(1, Math.min(12, month)) - 1];
  return `Dues-${label}`;
}

function monthlyPresenceKey(month: number): string {
  return monthNames[Math.max(1, Math.min(12, month)) - 1];
}

function workbookMonthAmount(raw: RawRow, month: number): number | null {
  const label = monthNames[Math.max(1, Math.min(12, month)) - 1];
  const candidates = [
    `${label}$`,
    `${label} $`,
    `${label.toLowerCase()}$`,
    `${label.toLowerCase()} $`,
    label,
  ];
  for (const key of candidates) {
    const amt = moneyFromCell(raw[key]);
    if (amt != null) return amt;
  }
  return null;
}

function workbookMoneyFields(raw: RawRow, year: number, month?: number) {
  const result = {
    total: moneyFromCell(raw["Total"]),
    duesPaidYear: moneyFromCell(raw[`${year} dues paid`]),
    balanceYear: moneyFromCell(raw[`${year} balance`]),
    raffleUpumi: moneyFromCell(raw["Raffle tix UPUMI fundraiser"]),
    raffleUpuaConvention: moneyFromCell(raw["Raffle tix UPUA convention"]),
    sswContribution: moneyFromCell(raw["SSW contribution"]),
    anambraContribution: moneyFromCell(raw["Anambra contribution"]),
    upua25Raffle: moneyFromCell(raw["upua 25 raffle"]),
    hostingPaymentLike: moneyFromCell(raw["Wrapper payment"]),
    insPremiumPaid: moneyFromCell(raw["Ins. premium paid"]),
    monthlyDuesCol: null as number | null,
  };

  if (month) {
    const key1 = monthlyDuesColumnKey(month);
    const key2 = month === 5 ? " Dues-May " : null;
    result.monthlyDuesCol = moneyFromCell(raw[key1] ?? (key2 ? raw[key2] : null));
  }
  return result;
}

function rowDescription(raw: RawRow) {
  return (
    strCell(raw["First"]) ||
    strCell(raw["Last"]) ||
    strCell(raw["Title"]) ||
    strCell(raw["Status"]) ||
    "—"
  );
}

const SENSITIVE_RAW_KEYS = new Set([
  "email",
  "phone",
  "phone2",
  "whatsapp",
  "facebook",
  "fb",
  "contact",
]);

function sanitizeRawJson(raw: RawRow) {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const norm = k.trim().toLowerCase();
    if (SENSITIVE_RAW_KEYS.has(norm)) continue;
    out[k] = v;
  }
  return out;
}

export async function analyticsRoutes(app: FastifyInstance) {
  const prismaAny = prisma as any;

  const fetchWorkbookLikeRows = async () => {
    const rows = await prismaAny.workbookRow.findMany({
      orderBy: { rowOrder: "asc" },
      select: {
        id: true,
        rowOrder: true,
        rowType: true,
        hosting: true,
        rawJson: true,
        title: true,
        firstName: true,
        lastName: true,
      },
    });
    if (rows.length) return rows;

    const legacy = await prisma.memberRecord.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        status: true,
        rawJson: true,
        title: true,
        firstName: true,
        lastName: true,
      },
    });

    return legacy.map((m: any, idx: number) => ({
      id: m.id,
      rowOrder: idx + 1,
      rowType: m.status,
      hosting: strCell(m.rawJson?.Hosting),
      rawJson: m.rawJson ?? {},
      title: m.title,
      firstName: m.firstName,
      lastName: m.lastName,
    }));
  };
  app.get("/me", { preHandler: [requireAuth] }, async (req: any) => {
    const year = toInt(req.query?.year, new Date().getFullYear());
    const userId = req.user?.sub || req.user?.id;

    if (!userId) return { linked: false };

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      include: {
        memberRecord: {
          include: { monthlyDues: { where: { year }, orderBy: { month: "asc" } } },
        },
      },
    });

    if (!user || !user.memberRecord) return { linked: false, monthlyDues: [] };

    const mr = user.memberRecord;
    return {
      linked: true,
      member: {
        firstName: mr.firstName,
        lastName: mr.lastName,
        status: mr.status,
        goodStanding: mr.goodStanding,
        financialGoodStanding: mr.financialGoodStanding,
        voter: mr.voter,
        insurance: mr.insurance,
        attendancePct: mr.attendancePct,
        title: mr.title,
        joined: mr.joined,
      },
      monthlyDues: mr.monthlyDues.map((d: any) => ({
        year: d.year,
        month: d.month,
        present: d.present ?? null,
        duesPaid: decimalToNumber(d.duesPaid),
      })),
    };
  });

  app.get("/summary", { preHandler: [requireAuth] }, async (req: any) => {
    const year = toInt(req.query?.year, new Date().getFullYear());

    const members = await prisma.memberRecord.findMany({
      include: { monthlyDues: { where: { year } } },
    });

    const membershipMix: Record<string, number> = {};
    const duesByMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: 0, paidCount: 0 }));

    for (const m of members) {
      const status = (m.status ?? "Unknown").trim() || "Unknown";
      membershipMix[status] = (membershipMix[status] ?? 0) + 1;

      for (const d of m.monthlyDues) {
        const idx = Math.max(1, Math.min(12, d.month)) - 1;
        const amt = decimalToNumber(d.duesPaid);
        if (amt != null) {
          duesByMonth[idx].total += amt;
          if (amt > 0) duesByMonth[idx].paidCount += 1;
        }
      }
    }

    return {
      year,
      kpis: {
        totalMembers: members.length,
        totalDues: duesByMonth.reduce((s, m) => s + m.total, 0),
      },
      membershipMix: Object.entries(membershipMix).map(([status, count]) => ({ status, count })),
      duesByMonth,
    };
  });

  app.get("/ledger-summary", { preHandler: [requireAuth] }, async (req: any) => {
    const year = toInt(req.query?.year, new Date().getFullYear());
    const month = Math.max(1, Math.min(12, toInt(req.query?.month, new Date().getMonth() + 1)));
    const workbookRows = await fetchWorkbookLikeRows();

    const byTypeMap: Record<string, { rowType: string; count: number; totalAmount: number; balanceAmount: number; duesPaidAmount: number }> = {};
    const monthlyMap: Record<string, { label: string; year: number; month: number; otherIncome: number; expense: number; balanceRows: number }> = {};
    const balanceRows: any[] = [];

    for (const r of workbookRows) {
      const rowTypeRaw = normalizeRowType(r.rowType);
      const rowType = rowTypeRaw || "unknown";
      const raw = (r.rawJson ?? {}) as RawRow;
      const money = workbookMoneyFields(raw, year);

      byTypeMap[rowType] ??= { rowType, count: 0, totalAmount: 0, balanceAmount: 0, duesPaidAmount: 0 };
      byTypeMap[rowType].count += 1;
      byTypeMap[rowType].totalAmount += money.total ?? 0;
      byTypeMap[rowType].balanceAmount += money.balanceYear ?? 0;
      byTypeMap[rowType].duesPaidAmount += money.duesPaidYear ?? 0;

      const period = parseHostingPeriod(r.hosting ?? strCell(raw["Hosting"]));
      if (period) {
        const key = `${period.year}-${period.month}`;
        monthlyMap[key] ??= { ...period, otherIncome: 0, expense: 0, balanceRows: 0 };
        if (rowType.includes("other income")) monthlyMap[key].otherIncome += money.total ?? 0;
        if (rowType.includes("expense")) monthlyMap[key].expense += money.total ?? 0;
        if (rowType.includes("balance")) monthlyMap[key].balanceRows += 1;
      }

      if (rowType.includes("balance")) {
        balanceRows.push({
          id: r.id,
          title: r.title ?? strCell(raw["Title"]),
          last: r.lastName ?? strCell(raw["Last"]),
          first: r.firstName ?? strCell(raw["First"]),
          duesPaidYear: money.duesPaidYear,
          balanceYear: money.balanceYear ?? money.total,
          total: money.total,
        });
      }
    }

    const byType = Object.values(byTypeMap).sort((a, b) => a.rowType.localeCompare(b.rowType));

    const balanceRowsMonthly: Array<{
      rowType: string;
      last: string | null;
      first: string | null;
      monthAmount: number | null;
      total: number | null;
      balanceYear: number | null;
    }> = workbookRows
      .filter((r: any) => normalizeRowType(r.rowType).includes("balance"))
      .map((r: any) => {
        const raw = (r.rawJson ?? {}) as RawRow;
        return {
          rowType: normalizeRowType(r.rowType),
          last: strCell(raw["Last"]) ?? r.lastName ?? null,
          first: strCell(raw["First"]) ?? r.firstName ?? null,
          monthAmount: workbookMonthAmount(raw, month),
          total: moneyFromCell(raw["Total"]),
          balanceYear: moneyFromCell(raw[`${year} balance`]),
        };
      });

    const incomeYtd = balanceRowsMonthly
      .filter((r: any) => String(r.last ?? "").trim().toLowerCase() === "total" && String(r.first ?? "").trim().toLowerCase() === "income")
      .reduce((s: number, r: any) => s + Number(r.monthAmount ?? r.total ?? 0), 0);
    const expenseYtd = balanceRowsMonthly
      .filter((r: any) => String(r.last ?? "").trim().toLowerCase() === "total" && String(r.first ?? "").trim().toLowerCase() === "expense")
      .reduce((s: number, r: any) => s + Math.abs(Number(r.monthAmount ?? r.total ?? 0)), 0);

    const accountBalances = balanceRowsMonthly
      .filter((r: any) => String(r.last ?? "").trim().toLowerCase() === "account")
      .map((r: any) => ({
        title: String(r.first ?? "Account").trim() || "Account",
        amount: Number(r.monthAmount ?? r.balanceYear ?? r.total ?? 0),
      }))
      .filter((r: any) => r.amount !== 0)
      .sort((a: any, b: any) => a.title.localeCompare(b.title));

    return {
      year,
      byType,
      monthly: Object.values(monthlyMap).sort((a, b) => (a.year - b.year) || (a.month - b.month)),
      balanceRows,
      accountBalances,
      ytd: {
        income: incomeYtd,
        expense: expenseYtd,
        net: incomeYtd - expenseYtd,
      },
    };
  });

  app.get("/monthly-report", { preHandler: [requireAuth] }, async (req: any) => {
    const year = toInt(req.query?.year, new Date().getFullYear());
    const month = Math.max(1, Math.min(12, toInt(req.query?.month, new Date().getMonth() + 1)));

    const duesPayments = await prisma.monthlyDue.findMany({
      where: {
        year,
        month,
        duesPaid: { gt: 0 as any },
      },
      orderBy: { duesPaid: "desc" },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, status: true },
        },
      },
    });

    const workbookRows = await fetchWorkbookLikeRows();

    const periodLabel = `${monthNames[month - 1]} ${year}`;
    const incomeRows: any[] = [];
    const expenseRows: any[] = [];
    const balanceRows: any[] = [];

    for (const r of workbookRows) {
      const rowType = normalizeRowType(r.rowType);
      const raw = (r.rawJson ?? {}) as RawRow;
      const period = parseHostingPeriod(r.hosting ?? strCell(raw["Hosting"]));
      const amounts = workbookMoneyFields(raw, year, month);
      const monthAmount = workbookMonthAmount(raw, month);

      const payload = {
        id: r.id,
        rowType: r.rowType ?? null,
        hosting: r.hosting ?? strCell(raw["Hosting"]),
        title: r.title ?? strCell(raw["Title"]),
        last: r.lastName ?? strCell(raw["Last"]),
        first: r.firstName ?? strCell(raw["First"]),
        description: rowDescription(raw),
        total: amounts.total,
        duesPaidYear: amounts.duesPaidYear,
        balanceYear: amounts.balanceYear,
        monthDueAmount: amounts.monthlyDuesCol,
        raffleUpumi: amounts.raffleUpumi,
        raffleUpuaConvention: amounts.raffleUpuaConvention,
        sswContribution: amounts.sswContribution,
        anambraContribution: amounts.anambraContribution,
        upua25Raffle: amounts.upua25Raffle,
        monthAmount,
      };

      const matchesMonthByHosting = !!period && period.year === year && period.month === month;
      const hasMonthAmount = monthAmount != null && monthAmount !== 0;

      if (rowType.includes("other income") && (matchesMonthByHosting || hasMonthAmount)) {
        incomeRows.push(payload);
      } else if (rowType.includes("expense") && (matchesMonthByHosting || hasMonthAmount)) {
        expenseRows.push(payload);
      } else if (rowType.includes("balance") && (hasMonthAmount || matchesMonthByHosting)) {
        balanceRows.push(payload);
      }
    }

    return {
      year,
      month,
      periodLabel,
      duesPayments: duesPayments.map((d: any) => ({
        id: d.id,
        amount: decimalToNumber(d.duesPaid) ?? 0,
        present: d.present ?? null,
        member: d.member
          ? {
              id: d.member.id,
              firstName: d.member.firstName,
              lastName: d.member.lastName,
              status: d.member.status,
            }
          : null,
      })),
      incomeRows,
      expenseRows,
      balanceRows,
    };
  });

  app.get("/pivot-members", { preHandler: [requireAuth] }, async (req: any) => {
    const year = toInt(req.query?.year, new Date().getFullYear());
    let rows = (await fetchWorkbookLikeRows()).filter(
      (r: any) => normalizeRowType(r.rowType ?? r.rawJson?.Status) === "member"
    );
    rows = rows.sort((a: any, b: any) => {
      const ha = String(a.hosting ?? a.rawJson?.Hosting ?? "");
      const hb = String(b.hosting ?? b.rawJson?.Hosting ?? "");
      if (ha !== hb) return ha.localeCompare(hb);
      const la = String(a.lastName ?? a.rawJson?.Last ?? "");
      const lb = String(b.lastName ?? b.rawJson?.Last ?? "");
      if (la !== lb) return la.localeCompare(lb);
      const fa = String(a.firstName ?? a.rawJson?.First ?? "");
      const fb = String(b.firstName ?? b.rawJson?.First ?? "");
      return fa.localeCompare(fb);
    });

    return {
      year,
      rows: rows.map((r: any) => {
        const raw = (r.rawJson ?? {}) as RawRow;
        const m = workbookMoneyFields(raw, year);
        return {
          id: r.id,
          rowType: strCell(raw["Status"]) ?? r.rowType ?? "Member",
          hosting: strCell(raw["Hosting"]) ?? r.hosting,
          last: strCell(raw["Last"]) ?? r.lastName,
          first: strCell(raw["First"]) ?? r.firstName,
          duesPaidYear: m.duesPaidYear,
          balanceYear: m.total ?? m.balanceYear,
          financialGoodStanding: strCell(raw["Financial GoodStanding"]),
          goodStanding: strCell(raw["GoodStanding"]),
          voter: strCell(raw["Voter"]),
          insured: strCell(raw["Insurance?"]),
          attendancePct: strCell(raw["%Attendance"]),
          raffleUpumi: m.raffleUpumi,
          raffleUpuaConvention: m.raffleUpuaConvention,
          sswContribution: m.sswContribution,
          anambraContribution: m.anambraContribution,
          upua25Raffle: m.upua25Raffle,
        };
      }),
    };
  });

  app.get("/member-details/:id", { preHandler: [requireAuth] }, async (req: any, reply) => {
    const id = String(req.params?.id ?? "");
    const row = await prismaAny.workbookRow.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rowType: true,
        hosting: true,
        rawJson: true,
        updatedAt: true,
      },
    });

    if (row) {
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        status: row.rowType,
        hosting: row.hosting,
        rawJson: sanitizeRawJson((row.rawJson ?? {}) as RawRow),
        updatedAt: row.updatedAt,
      };
    }

    // Fallback for legacy rows where pivot is sourced from MemberRecord IDs.
    const legacy = await prisma.memberRecord.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        rawJson: true,
        updatedAt: true,
      },
    });
    if (!legacy) return reply.code(404).send({ message: "Member not found" });
    return {
      id: legacy.id,
      firstName: legacy.firstName,
      lastName: legacy.lastName,
      status: legacy.status,
      hosting: strCell((legacy.rawJson as any)?.Hosting),
      rawJson: sanitizeRawJson((legacy.rawJson ?? {}) as RawRow),
      updatedAt: legacy.updatedAt,
    };
  });
}
