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
        memberRecord: {
          include: {
            monthlyDues: {
              where: { year: currentYear },
              orderBy: { month: 'asc' },
            },
          },
        },
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
      monthlyDues: mr.monthlyDues.map((d) => {
        const attendedInTable = attendanceMap.get(d.month) ?? false;
        const isPresent = d.present === true || attendedInTable;
        return {
          year: d.year,
          month: d.month,
          present: isPresent,
          duesPaid: decimalToNumber(d.duesPaid),
        };
      }),
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

    const prevYearBalanceMap = new Map<string, number>();
    for (const b of yearlyBalances) {
      if (b.memberRecordId) prevYearBalanceMap.set(b.memberRecordId, Number(b.balance));
    }

    return [...rows.map((row) => {
      const mapped = mapMemberRecord(row);
      const raw = parseRawJson(row.rawJson);
      const prevBal = prevYearBalanceMap.get(row.id);
      return {
        ...mapped,
        financialGoodStanding: computeFinancialGoodStanding(prevBal, mapped.financialGoodStanding),
      };
    }), ...userOnlyRows.map(mapUserAsMember)].sort((a, b) => {
      const aName = `${a.lastName ?? ''} ${a.firstName ?? ''}`.trim();
      const bName = `${b.lastName ?? ''} ${b.firstName ?? ''}`.trim();
      return aName.localeCompare(bName);
    });
  });
};