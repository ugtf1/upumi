import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../services/auth.js';
import { prisma } from '../services/prisma.js';

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
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

    const rawJson = typeof mr.rawJson === 'object' && mr.rawJson !== null
      ? (mr.rawJson as Record<string, unknown>)
      : undefined;

    return {
      linked: true,
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
        attendancePct: mr.attendancePct,
        email: (rawJson?.Email as string | null) ?? null,
        phone: (rawJson?.Phone as string | null) ?? null,
      },
      monthlyDues: mr.monthlyDues.map((d) => ({
        year: d.year,
        month: d.month,
        present: d.present ?? null,
        duesPaid: decimalToNumber(d.duesPaid),
      })),
    };
  });
};