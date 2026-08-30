import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../services/auth.js';
import { prisma } from '../services/prisma.js';

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function parseRawJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
}

export const meRoutes: FastifyPluginAsync = async (app) => {
  // Original route — kept for backwards compatibility
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, role: true, createdAt: true },
    });

    const memberRecord = await prisma.memberRecord.findFirst({
      where: { userId: req.user.sub },
      select: {
        id: true,
        status: true,
        title: true,
        firstName: true,
        lastName: true,
        joined: true,
        goodStanding: true,
        financialGoodStanding: true,
        voter: true,
        insurance: true,
        attendancePct: true,
        rawJson: true,
      },
    });

    return { user, memberRecord };
  });

  // GET /api/me/profile — returns member profile + monthly dues for the
  // current year. Used by MemberDashboard, MemberAccount, MemberTransaction.
  app.get('/profile', { preHandler: requireAuth }, async (req) => {
    const currentYear = new Date().getFullYear();
    const userId = req.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberRecord: true,
      },
    });

    if (!user) {
      return { linked: false, member: null, monthlyDues: [] };
    }

    const mr = user.memberRecord;

    if (!mr) {
      // User exists but has no MemberRecord — return basic user info
      return {
        linked: false,
        user: { id: user.id },
        member: null,
        monthlyDues: [],
      };
    }

    const rawJson = parseRawJson(mr.rawJson);

    // Fetch ALL attendance records directly from the database table to count meetings present
    const allAttendanceRows = await (prisma as any).attendance.findMany({
      select: { year: true, month: true, usersIn: true },
    }).catch(() => []);

    const attendanceMap = new Map<number, boolean>();
    let presentCount = 0;
    const memberName = `${mr.firstName ?? ''} ${mr.lastName ?? ''}`.trim().toLowerCase();

    for (const att of allAttendanceRows) {
      const usersInList = String(att.usersIn ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const isPresent =
        usersInList.includes(user.id.toLowerCase()) ||
        usersInList.includes(mr.id.toLowerCase()) ||
        usersInList.includes(mr.memberKey.toLowerCase()) ||
        usersInList.includes(`user.${user.id}`.toLowerCase()) ||
        (memberName.length > 0 && usersInList.some((u) => u.includes(memberName) || memberName.includes(u)));

      if (att.year === currentYear) {
        attendanceMap.set(att.month, isPresent);
      }
      if (isPresent) {
        presentCount++;
      }
    }

    const totalMeetings = allAttendanceRows.length;
    const computedPct = totalMeetings > 0 ? String(Math.round((presentCount / totalMeetings) * 100)) : (mr.attendancePct ?? '0');

    const hostingSchedules = await prisma.hostingSchedule.findMany({
      select: { year: true, month: true, hostMember: true },
    }).catch(() => []);

    const MONTH_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fullNameStr = `${mr.firstName ?? ''} ${mr.lastName ?? ''}`.trim();
    let hostingDate: string = (rawJson.Hosting as string) ?? (rawJson.hosting as string) ?? 'None';
    if (fullNameStr && hostingSchedules.length > 0) {
      const lowerName = fullNameStr.toLowerCase();
      const sched = hostingSchedules.find((h) => {
        const lowerHost = (h.hostMember || '').toLowerCase().trim();
        return lowerHost && (lowerHost.includes(lowerName) || lowerName.includes(lowerHost));
      });
      if (sched && sched.year && sched.month) {
        const mStr = MONTH_ABBRS[sched.month - 1] || 'Jan';
        hostingDate = `${mStr}, ${sched.year}`;
      }
    }

    return {
      linked: {
        userId: user.id,
        memberRecordId: mr.id,
        memberKey: mr.memberKey,
        displayMemberId: mr.memberKey,
      },
      user: { id: user.id },
      member: {
        firstName: mr.firstName,
        lastName: mr.lastName,
        status: mr.status,
        title: mr.title,
        joined: mr.joined,
        hosting: hostingDate,
        goodStanding: mr.goodStanding,
        financialGoodStanding: mr.financialGoodStanding,
        voter: mr.voter,
        insurance: mr.insurance,
        attendancePct: computedPct,
        attendanceCount: presentCount,
        totalMeetings: totalMeetings,
        email: (rawJson.Email as string) ?? null,
        phone: (rawJson.Phone as string) ?? null,
        address: user.address ?? (rawJson.Address as string) ?? null,
        whatsapp: mr.whatsapp ?? (rawJson.Whatsapp as string) ?? (rawJson.WhatsApp as string) ?? null,
        facebook: mr.facebook ?? (rawJson.Facebook as string) ?? (rawJson.FaceBook as string) ?? null,
        voteRole: user.voteRole ?? null,
        monthlyDuesAmount: decimalToNumber(user.monthlyDues),
        totalPaid: decimalToNumber(user.totalPaid),
        outstanding: decimalToNumber(user.outstanding),
      },
      // MonthlyDue table removed — dues now come from Transaction table (title='Dues')
      monthlyDues: [],
    };
  });

  // GET /api/me/members — read-only, member-safe mirror of GET /admin/members.
  // Identical merge logic (MemberRecord rows + orphan User rows) so the
  // member dashboard's Total/Active member counts always match the admin
  // dashboard exactly. Uses requireAuth only — any signed-in member/admin
  // can call this, but it exposes no write capability.
  app.get('/members', { preHandler: requireAuth }, async () => {
    const prismaAny = prisma as any;

    const rows = await prisma.memberRecord.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        memberKey: true,
        status: true,
        title: true,
        firstName: true,
        lastName: true,
        joined: true,
        phone: true,
        email: true,
        goodStanding: true,
        financialGoodStanding: true,
        voter: true,
        attendancePct: true,
        rawJson: true,
        userId: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            phone: true,
            email: true,
            fName: true,
            lName: true,
            status: true,
            dateJoined: true,
            voteRole: true,
          },
        },
      },
    });

    const userOnlyRows = await prismaAny.user.findMany({
      where: {
        role: 'MEMBER',
        memberRecord: { is: null },
      },
      orderBy: [{ lName: 'asc' }, { fName: 'asc' }],
      select: {
        id: true,
        phone: true,
        email: true,
        fName: true,
        lName: true,
        dateJoined: true,
        voteRole: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    function strCell(value: unknown): string | null {
      const text = String(value ?? '').trim();
      return text || null;
    }

    function rawMoney(raw: Record<string, any>, keys: string[]): number | null {
      for (const key of keys) {
        const value = raw[key];
        if (value === null || value === undefined || value === '') continue;
        const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(numeric)) return numeric;
      }
      return null;
    }

    function decimalToNumber(value: unknown): number | null {
      if (value === null || value === undefined) return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }

    function parseRawJson(value: unknown): Record<string, any> {
      if (!value) return {};
      if (typeof value === 'string') {
        try { return JSON.parse(value); } catch { return {}; }
      }
      return value as Record<string, any>;
    }

    function computeFinancialGoodStanding(prevYearBalance: number | null | undefined, fallbackValue?: string | null): string {
      if (prevYearBalance !== null && prevYearBalance !== undefined && Number.isFinite(Number(prevYearBalance))) {
        return Number(prevYearBalance) <= -240 ? "No" : "Yes";
      }
      if (fallbackValue) {
        const v = String(fallbackValue).trim().toLowerCase();
        if (v === "yes" || v === "good" || v === "active" || v === "true" || v === "1") return "Yes";
        if (v === "no" || v === "bad" || v === "inactive" || v === "false" || v === "0") return "No";
        return String(fallbackValue);
      }
      return "Yes";
    }

    function mapMemberRecord(row: any) {
      const raw = parseRawJson(row.rawJson);
      return {
        id: row.id,
        memberKey: row.memberKey,
        displayMemberId: row.memberKey,
        status: strCell(row.status) ?? strCell(row.user?.status) ?? 'Active',
        title: strCell(row.title) ?? strCell(raw.Title),
        firstName: strCell(row.firstName) ?? strCell(row.user?.fName) ?? strCell(raw.First),
        lastName: strCell(row.lastName) ?? strCell(row.user?.lName) ?? strCell(raw.Last),
        joined: strCell(row.joined) ?? strCell(raw.Joined) ?? row.user?.dateJoined ?? null,
        hosting: strCell(raw.Hosting) ?? strCell(raw.hosting) ?? null,
        balance: rawMoney(raw, ['2026 balance', '2025 balance', '2024 balance', 'balance', 'Balance']) ?? 0,
        crntPaid: rawMoney(raw, ['2026 dues paid', '2025 dues paid', '2024 dues paid', 'dues paid', 'Dues Paid']) ?? decimalToNumber(row.user?.totalPaid) ?? 0,
        raffleUpumi: rawMoney(raw, ['Raffle tix UPUMI fundraiser', 'Raffle tix UPUMI', 'Raffle UPUMI']) ?? 0,
        raffleUpua: rawMoney(raw, ['Raffle tix UPUA convention', 'upua 25 raffle', 'Raffle UPUA']) ?? 0,
        phone: strCell(row.phone) ?? strCell(row.user?.phone) ?? strCell(raw.Phone),
        email: strCell(row.email) ?? strCell(row.user?.email) ?? strCell(raw.Email),
        goodStanding: strCell(row.goodStanding) ?? strCell(raw.GoodStanding),
        financialGoodStanding: strCell(row.financialGoodStanding) ?? strCell(raw['Financial GoodStanding']),
        voter: strCell(row.voter) ?? strCell(row.user?.voteRole) ?? strCell(raw.Voter),
        attendancePct: strCell(row.attendancePct) ?? strCell(raw['%Attendance']),
        userId: row.userId,
        updatedAt: row.updatedAt,
      };
    }

    function mapUserAsMember(user: any) {
      return {
        id: user.id,
        memberKey: `user.${user.id}`,
        displayMemberId: `user.${user.id}`,
        status: strCell(user.status) ?? 'Active',
        title: null,
        firstName: strCell(user.fName),
        lastName: strCell(user.lName),
        joined: user.dateJoined ?? user.createdAt ?? null,
        hosting: null,
        balance: 0,
        crntPaid: decimalToNumber(user.totalPaid) ?? 0,
        raffleUpumi: 0,
        raffleUpua: 0,
        phone: strCell(user.phone),
        email: strCell(user.email),
        goodStanding: null,
        financialGoodStanding: null,
        voter: strCell(user.voteRole),
        attendancePct: null,
        userId: user.id,
        updatedAt: user.updatedAt,
      };
    }

    const prevYear = new Date().getFullYear() - 1;
    const yearlyBalances = await prismaAny.memberYearlyBalance.findMany({
      where: { year: prevYear },
      select: { memberRecordId: true, balance: true },
    }).catch(() => []);

    const hostingSchedules = await prisma.hostingSchedule.findMany({
      select: { year: true, month: true, hostMember: true },
    }).catch(() => []);

    const allTransactions = await prisma.transaction.findMany({
      select: { userId: true, fullName: true, title: true, amount: true },
    }).catch(() => []);

    const MONTH_ABBRS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function formatHostingDate(rawHosting?: string | null, fullName?: string): string {
      if (fullName && hostingSchedules.length > 0) {
        const lowerName = fullName.toLowerCase().trim();
        const sched = hostingSchedules.find((h) => {
          const lowerHost = (h.hostMember || '').toLowerCase().trim();
          return lowerHost && (lowerHost.includes(lowerName) || lowerName.includes(lowerHost));
        });
        if (sched && sched.year && sched.month) {
          const mStr = MONTH_ABBRS[sched.month - 1] || 'Jan';
          return `${mStr}, ${sched.year}`;
        }
      }

      if (!rawHosting || rawHosting === '-' || rawHosting === 'None') return 'None';
      // Already formatted (contains comma but no dash)
      if (rawHosting.includes(',') && !rawHosting.includes('-')) return rawHosting;

      const d = new Date(rawHosting);
      if (!Number.isNaN(d.getTime())) {
        const mStr = MONTH_ABBRS[d.getMonth()];
        return `${mStr}, ${d.getFullYear()}`;
      }
      return rawHosting;
    }

    function calculateMemberTxTotals(userId: string | null | undefined, fullName: string, fallback: { crntPaid: number; raffleUpumi: number; raffleUpua: number }) {
      const lowerName = fullName.toLowerCase().trim();
      const userTxs = allTransactions.filter((t) => {
        if (userId && t.userId === userId) return true;
        if (t.fullName && lowerName && t.fullName.toLowerCase().trim() === lowerName) return true;
        return false;
      });

      let duesSum = 0;
      let hasDuesTxs = false;

      let raffleUpumiSum = 0;
      let hasRaffleUpumiTxs = false;

      let raffleUpuaSum = 0;
      let hasRaffleUpuaTxs = false;

      for (const t of userTxs) {
        const amt = Number(t.amount ?? 0);
        const title = (t.title || '').toLowerCase().trim();

        if (title.includes('due')) {
          duesSum += amt;
          hasDuesTxs = true;
        }

        if (title.includes('upua') && title.includes('raffle')) {
          raffleUpuaSum += amt;
          hasRaffleUpuaTxs = true;
        } else if (title.includes('raffle')) {
          raffleUpumiSum += amt;
          hasRaffleUpumiTxs = true;
        }
      }

      return {
        crntPaid: hasDuesTxs ? duesSum : fallback.crntPaid,
        raffleUpumi: hasRaffleUpumiTxs ? raffleUpumiSum : fallback.raffleUpumi,
        raffleUpua: hasRaffleUpuaTxs ? raffleUpuaSum : fallback.raffleUpua,
      };
    }

    const prevYearBalanceMap = new Map<string, number>();
    for (const b of yearlyBalances) {
      if (b.memberRecordId) prevYearBalanceMap.set(b.memberRecordId, Number(b.balance));
    }

    return [...rows.map((row) => {
      const mapped = mapMemberRecord(row);
      const raw = parseRawJson(row.rawJson);
      const prevBal = prevYearBalanceMap.get(row.id);
      const fullName = `${mapped.firstName ?? ''} ${mapped.lastName ?? ''}`.trim();
      const txTotals = calculateMemberTxTotals(mapped.userId, fullName, {
        crntPaid: mapped.crntPaid,
        raffleUpumi: mapped.raffleUpumi,
        raffleUpua: mapped.raffleUpua,
      });

      return {
        ...mapped,
        hosting: formatHostingDate(mapped.hosting, fullName),
        crntPaid: txTotals.crntPaid,
        raffleUpumi: txTotals.raffleUpumi,
        raffleUpua: txTotals.raffleUpua,
        financialGoodStanding: computeFinancialGoodStanding(prevBal, mapped.financialGoodStanding),
      };
    }), ...userOnlyRows.map((userRow: any) => {
      const mapped = mapUserAsMember(userRow);
      const fullName = `${mapped.firstName ?? ''} ${mapped.lastName ?? ''}`.trim();
      const txTotals = calculateMemberTxTotals(mapped.userId, fullName, {
        crntPaid: mapped.crntPaid,
        raffleUpumi: mapped.raffleUpumi,
        raffleUpua: mapped.raffleUpua,
      });

      return {
        ...mapped,
        hosting: formatHostingDate(mapped.hosting, fullName),
        crntPaid: txTotals.crntPaid,
        raffleUpumi: txTotals.raffleUpumi,
        raffleUpua: txTotals.raffleUpua,
      };
    })].sort((a, b) => {
      const aName = `${a.lastName ?? ''} ${a.firstName ?? ''}`.trim();
      const bName = `${b.lastName ?? ''} ${b.firstName ?? ''}`.trim();
      return aName.localeCompare(bName);
    });
  });
};