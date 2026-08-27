import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../services/auth.js';
import { prisma } from '../services/prisma.js';
import { importWorkbookCsv, toSheetCsvExportUrl } from '../services/workbookImport.js';
import { normalizePhone, phoneLookupCandidates } from '../services/phone.js';

const ImportSchema = z.object({
  csvText: z.string().min(1),
  year: z.number().int().min(2000).max(2100).default(2025),
});

const WorkbookRowCreateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  rowType: z.string().min(1),
  hosting: z.string().optional().default(''),
  title: z.string().optional().default(''),
  firstName: z.string().optional().default(''),
  lastName: z.string().optional().default(''),
  rawJson: z.record(z.any()).optional(),
});

const WorkbookColumnUpsertSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  columnKey: z.string().min(1),
  defaultValue: z.any().optional(),
  rowType: z.string().optional(),
});

const SENSITIVE_RAW_KEYS = new Set([
  'email',
  'phone',
  'phone2',
  'whatsapp',
  'facebook',
  'fb',
  'contact',
]);

function sanitizeRawJson(raw: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const norm = k.trim().toLowerCase();
    if (SENSITIVE_RAW_KEYS.has(norm)) continue;
    out[k] = v;
  }
  return out;
}

function parseRawJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string') return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {};
  } catch {
    return {};
  }
}

function strCell(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const prismaAny = prisma as any;
  // List all members (admin)
  app.get('/members', { preHandler: requireRole('ADMIN') }, async () => {
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
      const prevBal = prevYearBalanceMap.get(row.id) ?? rawMoney(raw, [`${prevYear} balance`, `${prevYear} Balance`, 'Balance']);
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

  app.get('/members/:id', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const id = String(req.params?.id ?? '');
    const row = await prisma.memberRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            email: true,
            fName: true,
            lName: true,
            address: true,
            dateJoined: true,
            voteRole: true,
            monthlyDues: true,
            totalPaid: true,
            outstanding: true,
            status: true,
          },
        },
        monthlyDues: { orderBy: [{ year: 'desc' }, { month: 'asc' }] },
      },
    });

    if (!row) {
      const userId = id.startsWith('user.') ? id.slice('user.'.length) : id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          email: true,
          fName: true,
          lName: true,
          address: true,
          dateJoined: true,
          voteRole: true,
          monthlyDues: true,
          totalPaid: true,
          outstanding: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) return reply.code(404).send({ message: 'Member not found' });

      const linkedRecord = await prisma.memberRecord.findFirst({
        where: { userId },
        include: { monthlyDues: true },
      }).catch(() => null);

      const userFullName = `${user.fName ?? ''} ${user.lName ?? ''}`.trim().toLowerCase();
      const userCandidateIds = [
        user.id,
        `user.${user.id}`,
        linkedRecord?.id,
        linkedRecord?.memberKey,
      ].filter(Boolean).map((s: any) => String(s).toLowerCase());

      const attendanceRowsForUser = await prismaAny.attendance.findMany({
        select: { year: true, month: true, usersIn: true }
      }).catch(() => []);

      const userAttendanceMap = new Map<string, boolean>();
      let userPresentCount = 0;

      for (const att of attendanceRowsForUser) {
        const usersInList = String(att.usersIn ?? '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        const isPresent =
          userCandidateIds.some((cid) => usersInList.includes(cid)) ||
          (userFullName.length > 0 && usersInList.some((u: string) => u.includes(userFullName) || userFullName.includes(u)));

        userAttendanceMap.set(`${att.year}-${att.month}`, isPresent);
        if (isPresent) userPresentCount++;
      }

      const userTotalMeetings = attendanceRowsForUser.length;
      const userComputedPct = userTotalMeetings > 0 ? String(Math.round((userPresentCount / userTotalMeetings) * 100)) : (linkedRecord?.attendancePct ?? '0');

      return {
        ...mapUserAsMember(user),
        address: strCell(user.address),
        monthlyDuesAmount: decimalToNumber(user.monthlyDues) ?? 0,
        totalPaid: decimalToNumber(user.totalPaid) ?? 0,
        outstanding: decimalToNumber(user.outstanding) ?? 0,
        attendancePct: userComputedPct,
        attendanceCount: userPresentCount,
        totalMeetings: userTotalMeetings,
        memberKey: linkedRecord?.memberKey ?? `user.${user.id}`,
        monthlyDues: (linkedRecord?.monthlyDues ?? []).map((due: any) => {
          const attKey = `${due.year}-${due.month}`;
          const presentInTable = userAttendanceMap.get(attKey) ?? false;
          return {
            id: due.id,
            year: due.year,
            month: due.month,
            present: due.present === true || presentInTable,
            duesPaid: decimalToNumber(due.duesPaid) ?? 0,
            createdAt: due.createdAt,
          };
        }),
        rawJson: {},
      };
    }

    const attendanceRows = await prismaAny.attendance.findMany({
      select: { year: true, month: true, usersIn: true }
    }).catch(() => []);

    const attendanceMap = new Map<string, boolean>();
    let presentCount = 0;
    const memberName = `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim().toLowerCase();
    const candidateIds = [
      row.id,
      row.memberKey,
      row.userId,
      row.userId ? `user.${row.userId}` : null,
      row.id ? `user.${row.id}` : null,
    ].filter(Boolean).map((s: any) => String(s).toLowerCase());

    for (const att of attendanceRows) {
      const usersInList = String(att.usersIn ?? '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
      const isPresent =
        candidateIds.some((cid) => usersInList.includes(cid)) ||
        (memberName.length > 0 && usersInList.some((u: string) => u.includes(memberName) || memberName.includes(u)));

      attendanceMap.set(`${att.year}-${att.month}`, isPresent);
      if (isPresent) {
        presentCount++;
      }
    }

    const totalMeetings = attendanceRows.length;
    const computedPct = totalMeetings > 0 ? String(Math.round((presentCount / totalMeetings) * 100)) : (strCell(row.attendancePct) ?? '0');

    const raw = parseRawJson(row.rawJson);
    const prevYear = new Date().getFullYear() - 1;
    const prevBalRow = await prismaAny.memberYearlyBalance.findFirst({
      where: { memberRecordId: row.id, year: prevYear },
      select: { balance: true },
    }).catch(() => null);
    const prevBal = prevBalRow ? Number(prevBalRow.balance) : rawMoney(raw, [`${prevYear} balance`, `${prevYear} Balance`, 'Balance']);
    const finGoodStanding = computeFinancialGoodStanding(prevBal, strCell(row.financialGoodStanding) ?? strCell(raw['Financial GoodStanding']));

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
      address: strCell(row.user?.address) ?? strCell(raw.Address),
      attendancePct: computedPct,
      attendanceCount: presentCount,
      totalMeetings: totalMeetings,
      voter: strCell(row.voter) ?? strCell(row.user?.voteRole) ?? strCell(raw.Voter),
      goodStanding: strCell(row.goodStanding) ?? strCell(raw.GoodStanding),
      financialGoodStanding: finGoodStanding,
      monthlyDuesAmount: decimalToNumber(row.user?.monthlyDues) ?? rawMoney(raw, ['Monthly Dues', 'monthlyDues']),
      totalPaid: decimalToNumber(row.user?.totalPaid) ?? rawMoney(raw, ['Total', '2026 dues paid', '2025 dues paid']),
      outstanding: decimalToNumber(row.user?.outstanding) ?? rawMoney(raw, ['Balance', '2026 balance', '2025 balance']),
      whatsapp: strCell(row.whatsapp) ?? strCell(raw.Whatsapp ?? raw.WhatsApp),
      facebook: strCell(row.facebook) ?? strCell(raw.Facebook ?? raw.FaceBook),
      insurance: strCell(row.insurance) ?? strCell(raw.Insurance ?? raw['Insurance?']),
      monthlyDues: row.monthlyDues.map((due: any) => {
        const attKey = `${due.year}-${due.month}`;
        const presentInTable = attendanceMap.get(attKey) ?? false;
        return {
          id: due.id,
          year: due.year,
          month: due.month,
          present: due.present === true || presentInTable,
          duesPaid: decimalToNumber(due.duesPaid) ?? 0,
          createdAt: due.createdAt,
        };
      }),
      rawJson: sanitizeRawJson(raw),
      userId: row.userId,
      updatedAt: row.updatedAt,
    };
  });

  // Import / re-import workbook CSV (admin)
  app.post('/import-members', { preHandler: requireRole('ADMIN') }, async (req, reply) => {
    const body = ImportSchema.parse(req.body);
    const result = await importWorkbookCsv(body.csvText, body.year);
    return reply.send({ imported: result.importedMembers, skipped: result.skippedMembers, workbookRows: result.workbookRows, duesRows: result.duesRows });
  });

  app.post('/sync-google-sheet', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const year = Number(req.body?.year ?? process.env.GOOGLE_SHEET_YEAR ?? new Date().getFullYear());
    const source = String(
      req.body?.sheetUrl ??
      process.env.GOOGLE_SHEET_URL ??
      process.env.GOOGLE_SHEET_CSV_URL ??
      ''
    ).trim();
    const gid = String(req.body?.gid ?? process.env.GOOGLE_SHEET_GID ?? '').trim();
    const sheetTab = String(req.body?.sheetTab ?? process.env.GOOGLE_SHEET_TAB ?? 'member_status').trim();

    if (!source) {
      return reply.code(400).send({ message: 'Missing GOOGLE_SHEET_URL or GOOGLE_SHEET_CSV_URL' });
    }

    const url = toSheetCsvExportUrl(source, { gid, sheetTab });
    const res = await fetch(url);
    if (!res.ok) {
      return reply.code(502).send({ message: `Google Sheet fetch failed (${res.status})` });
    }
    const csvText = await res.text();
    const result = await importWorkbookCsv(csvText, year);
    return { sourceUrl: url, year, ...result };
  });

  app.post('/cron/sync-google-sheet', async (req: any, reply) => {
    const cronSecret = process.env.SCHEDULER_IMPORT_SECRET ?? '';
    if (!cronSecret) {
      return reply.code(500).send({ message: 'SCHEDULER_IMPORT_SECRET is not configured' });
    }
    const provided = String(req.headers['x-scheduler-secret'] ?? '');
    if (!provided || provided !== cronSecret) {
      return reply.code(401).send({ message: 'Unauthorized' });
    }

    const year = Number(process.env.GOOGLE_SHEET_YEAR ?? new Date().getFullYear());
    const source = String(process.env.GOOGLE_SHEET_URL ?? process.env.GOOGLE_SHEET_CSV_URL ?? '').trim();
    const gid = String(process.env.GOOGLE_SHEET_GID ?? '').trim();
    const sheetTab = String(process.env.GOOGLE_SHEET_TAB ?? 'member_status').trim();
    if (!source) {
      return reply.code(500).send({ message: 'Missing GOOGLE_SHEET_URL or GOOGLE_SHEET_CSV_URL' });
    }

    const url = toSheetCsvExportUrl(source, { gid, sheetTab });
    const res = await fetch(url);
    if (!res.ok) {
      return reply.code(502).send({ message: `Google Sheet fetch failed (${res.status})` });
    }
    const csvText = await res.text();
    const result = await importWorkbookCsv(csvText, year);
    return { sourceUrl: url, year, ...result };
  });

  app.get('/workbook-rows', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const year = Number(req.query?.year ?? 0);
    const rowType = String(req.query?.rowType ?? '').trim();
    const search = String(req.query?.search ?? '').trim().toLowerCase();

    const rows = await prismaAny.workbookRow.findMany({
      where: {
        ...(Number.isFinite(year) && year > 0 ? { sourceYear: year } : {}),
        ...(rowType && rowType !== 'all' ? { rowType: { equals: rowType, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ rowType: 'asc' }, { hosting: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }, { rowOrder: 'asc' }],
    });

    const filtered = !search
      ? rows
      : rows.filter((r: any) =>
          [r.rowType, r.hosting, r.firstName, r.lastName, r.title]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ')
            .includes(search)
        );

    const columnSet = new Set<string>();
    for (const r of filtered) {
      for (const k of Object.keys((r.rawJson ?? {}) as Record<string, unknown>)) {
        const norm = k.trim().toLowerCase();
        if (SENSITIVE_RAW_KEYS.has(norm)) continue;
        columnSet.add(k);
      }
    }

    return {
      columns: Array.from(columnSet).sort((a, b) => a.localeCompare(b)),
      rows: filtered.map((r: any) => ({
        id: r.id,
        sourceYear: r.sourceYear,
        rowOrder: r.rowOrder,
        rowType: r.rowType,
        hosting: r.hosting,
        title: r.title,
        firstName: r.firstName,
        lastName: r.lastName,
        rawJson: sanitizeRawJson(r.rawJson ?? {}),
      })),
    };
  });

  app.patch('/workbook-rows/:id', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const id = String(req.params?.id ?? '');
    const body = z
      .object({
        rowType: z.string().optional(),
        hosting: z.string().optional(),
        title: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        rawJson: z.record(z.any()).optional(),
      })
      .parse(req.body ?? {});

    const existing = await prismaAny.workbookRow.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: 'Workbook row not found' });

    const mergedRaw = {
      ...(existing.rawJson ?? {}),
      ...(body.rawJson ?? {}),
      ...(body.rowType !== undefined ? { Status: body.rowType } : {}),
      ...(body.hosting !== undefined ? { Hosting: body.hosting } : {}),
      ...(body.title !== undefined ? { Title: body.title } : {}),
      ...(body.firstName !== undefined ? { First: body.firstName } : {}),
      ...(body.lastName !== undefined ? { Last: body.lastName } : {}),
    };

    const updated = await prismaAny.workbookRow.update({
      where: { id },
      data: {
        ...(body.rowType !== undefined ? { rowType: body.rowType } : {}),
        ...(body.hosting !== undefined ? { hosting: body.hosting } : {}),
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        rawJson: mergedRaw,
      },
      select: { id: true, rowType: true, hosting: true, title: true, firstName: true, lastName: true, rawJson: true },
    });

    return { ...updated, rawJson: sanitizeRawJson(updated.rawJson ?? {}) };
  });

  app.post('/workbook-rows', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const body = WorkbookRowCreateSchema.parse(req.body ?? {});
    const maxOrder = await prismaAny.workbookRow.aggregate({
      where: { sourceYear: body.year },
      _max: { rowOrder: true },
    });
    const nextOrder = Number(maxOrder?._max?.rowOrder ?? 0) + 1;

    const baseRaw = {
      Status: body.rowType,
      Hosting: body.hosting || '',
      Title: body.title || '',
      Last: body.lastName || '',
      First: body.firstName || '',
    };
    const rawJson = {
      ...baseRaw,
      ...(body.rawJson ?? {}),
    };

    const created = await prismaAny.workbookRow.create({
      data: {
        sourceYear: body.year,
        rowOrder: nextOrder,
        rowType: body.rowType,
        hosting: body.hosting || null,
        title: body.title || null,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        rawJson,
      },
      select: {
        id: true,
        sourceYear: true,
        rowOrder: true,
        rowType: true,
        hosting: true,
        title: true,
        firstName: true,
        lastName: true,
        rawJson: true,
      },
    });

    return { ...created, rawJson: sanitizeRawJson(created.rawJson ?? {}) };
  });

  app.post('/workbook-columns', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const body = WorkbookColumnUpsertSchema.parse(req.body ?? {});
    const key = body.columnKey.trim();
    const normalized = key.toLowerCase();
    if (SENSITIVE_RAW_KEYS.has(normalized)) {
      const err: any = new Error('This column key is restricted');
      err.statusCode = 400;
      throw err;
    }

    const where: Record<string, any> = { sourceYear: body.year };
    if (body.rowType && body.rowType.trim() && body.rowType.trim().toLowerCase() !== 'all') {
      where.rowType = { equals: body.rowType.trim(), mode: 'insensitive' };
    }

    const rows = await prismaAny.workbookRow.findMany({
      where,
      select: { id: true, rawJson: true },
    });

    for (const row of rows) {
      const current = (row.rawJson ?? {}) as Record<string, any>;
      await prismaAny.workbookRow.update({
        where: { id: row.id },
        data: {
          rawJson: {
            ...current,
            [key]: body.defaultValue ?? '',
          },
        },
      });
    }

    return { updatedRows: rows.length, columnKey: key };
  });

  app.get('/export-workbook.csv', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const year = Number(req.query?.year ?? 0);
    const rows = await prismaAny.workbookRow.findMany({
      where: Number.isFinite(year) && year > 0 ? { sourceYear: year } : {},
      orderBy: [{ rowOrder: 'asc' }],
      select: { rawJson: true },
    });

    const jsonRows = rows.map((r: any) => r.rawJson ?? {});
    const headerSet = new Set<string>();
    for (const r of jsonRows) Object.keys(r).forEach((k) => headerSet.add(k));
    const headers = Array.from(headerSet);

    const esc = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [headers.join(',')];
    for (const r of jsonRows) {
      lines.push(headers.map((h) => esc(r[h])).join(','));
    }

    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', `attachment; filename="upumi-workbook-${year || 'all'}.csv"`);
    return lines.join('\n');
  });

  // Link a workbook row to a user (e.g., member has no email in workbook, or uses a different email)
  app.post('/link-member', { preHandler: requireRole('ADMIN') }, async (req) => {
    const Body = z.object({
      memberRecordId: z.string().min(1),
      userEmail: z.string().email().transform((s) => s.toLowerCase().trim()),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: Body.userEmail } });
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    return prisma.memberRecord.update({
      where: { id: Body.memberRecordId },
      data: { userId: user.id },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });
  });

  app.patch('/members/:id', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const id = String(req.params?.id ?? '');
    const Body = z.object({
      fName: z.string().min(1).optional(),
      lName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(1).optional(),
      address: z.string().optional(),
      dateJoined: z.string().nullable().optional(),
      voteRole: z.string().optional(),
      monthlyDues: z.number().optional(),
      totalPaid: z.number().optional(),
      outstanding: z.number().optional(),
      status: z.string().optional(),
      whatsapp: z.string().optional(),
      facebook: z.string().optional(),
      insurance: z.string().optional(),
      goodStanding: z.string().optional(),
      financialGoodStanding: z.string().optional(),
    }).parse(req.body ?? {});

    // Normalize phone so it matches the format used at login
    const normalizedPhone = Body.phone !== undefined ? normalizePhone(Body.phone) : undefined;

    const userOnlyId = id.startsWith('user.') ? id.slice('user.'.length) : id;
    let existing = await prisma.memberRecord.findUnique({
      where: { id },
    });
    if (!existing) {
      existing = await prisma.memberRecord.findFirst({
        where: { userId: userOnlyId },
      });
    }

    const userOnly = await prisma.user.findUnique({
      where: { id: userOnlyId },
    });
    if (!existing && !userOnly) return reply.code(404).send({ message: 'Member not found' });

    const parseDate = (value: string | null | undefined) => {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    let memberRecord = existing;
    if (!memberRecord && userOnly) {
      memberRecord = await prisma.memberRecord.create({
        data: {
          memberKey: `user.${userOnly.id}`,
          status: Body.status ?? 'Active',
          firstName: Body.fName ?? userOnly.fName ?? null,
          lastName: Body.lName ?? userOnly.lName ?? null,
          joined: userOnly.dateJoined?.toISOString() ?? userOnly.createdAt.toISOString(),
          phone: normalizedPhone ?? userOnly.phone ?? null,
          email: Body.email?.toLowerCase().trim() ?? userOnly.email ?? null,
          userId: userOnly.id,
          rawJson: '{}',
        } as any,
      });
    }

    const updated = await prisma.memberRecord.update({
      where: { id: memberRecord!.id },
      data: {
        ...(Body.fName !== undefined ? { firstName: Body.fName } : {}),
        ...(Body.lName !== undefined ? { lastName: Body.lName } : {}),
        ...(Body.email !== undefined ? { email: Body.email.toLowerCase().trim() } : {}),
        ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
        ...(Body.status !== undefined ? { status: Body.status } : {}),
        ...(Body.dateJoined !== undefined ? { joined: Body.dateJoined ?? null } : {}),
        ...(Body.voteRole !== undefined ? { voter: Body.voteRole } : {}),
        ...(Body.whatsapp !== undefined ? { whatsapp: Body.whatsapp } : {}),
        ...(Body.facebook !== undefined ? { facebook: Body.facebook } : {}),
        ...(Body.insurance !== undefined ? { insurance: Body.insurance } : {}),
        ...(Body.goodStanding !== undefined ? { goodStanding: Body.goodStanding } : {}),
        ...(Body.financialGoodStanding !== undefined ? { financialGoodStanding: Body.financialGoodStanding } : {}),
      },
      select: {
        id: true,
        memberKey: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        joined: true,
        status: true,
        voter: true,
        userId: true,
        whatsapp: true,
        facebook: true,
        insurance: true,
        goodStanding: true,
        financialGoodStanding: true,
      },
    });

    if (existing?.userId || userOnly) {
      await prisma.user.update({
        where: { id: existing?.userId ?? userOnlyId },
        data: {
          ...(Body.fName !== undefined ? { fName: Body.fName } : {}),
          ...(Body.lName !== undefined ? { lName: Body.lName } : {}),
          ...(Body.email !== undefined ? { email: Body.email.toLowerCase().trim() } : {}),
          ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
          ...(Body.address !== undefined ? { address: Body.address } : {}),
          ...(Body.dateJoined !== undefined ? { dateJoined: parseDate(Body.dateJoined) } : {}),
          ...(Body.voteRole !== undefined ? { voteRole: Body.voteRole } : {}),
          ...(Body.monthlyDues !== undefined ? { monthlyDues: Body.monthlyDues as any } : {}),
          ...(Body.totalPaid !== undefined ? { totalPaid: Body.totalPaid as any } : {}),
          ...(Body.outstanding !== undefined ? { outstanding: Body.outstanding as any } : {}),
          ...(Body.status !== undefined ? { status: Body.status } : {}),
        },
      });
    }

    return updated;
  });

  // Delete a member. Handles three cases:
  //  1. MemberRecord-backed (spreadsheet import): delete MemberRecord + linked User
  //  2. User-only (Add Member form, plain User.id): delete User (cascades to MemberRecord if linked)
  //  3. 'user.' prefixed id: strip prefix then treat as User.id
  app.delete('/members/:id', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const id = String(req.params?.id ?? '');

    if (id.startsWith('user.')) {
      const userId = id.slice('user.'.length);
      await prisma.user.delete({ where: { id: userId } }).catch(() => null);
      return { ok: true };
    }

    // Try as MemberRecord.id first.
    const record = await prisma.memberRecord.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (record) {
      // Delete the MemberRecord (cascades to MonthlyDue etc).
      await prisma.memberRecord.delete({ where: { id: record.id } });
      // Also delete the linked User if one exists.
      if (record.userId) {
        await prisma.user.delete({ where: { id: record.userId } }).catch(() => null);
      }
      return { ok: true };
    }

    // Fall back: treat id as a plain User.id (mapUserAsMember path).
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) return reply.code(404).send({ message: 'Member not found' });

    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });

  // Record or update a monthly due payment for a member.
  // Uses upsert on the @@unique([memberRecordId, year, month]) constraint so
  // re-submitting the same month overwrites rather than errors.
  app.post('/members/:id/monthly-dues', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const id = String(req.params?.id ?? '');

    const Body = z.object({
      year: z.number().int().min(2000).max(2100),
      month: z.number().int().min(1).max(12),
      duesPaid: z.number().min(0),
      present: z.boolean().optional(),
    }).parse(req.body ?? {});

    // Resolve the memberRecordId — handles both a real MemberRecord cuid and
    // a 'user.<userId>' virtual id used for members who have no MemberRecord row.
    let memberRecordId: string;

    if (id.startsWith('user.')) {
      const userId = id.slice('user.'.length);
      // Find or create a MemberRecord for this user so MonthlyDue has something to link to.
      const existing = await prisma.memberRecord.findFirst({ where: { userId } });
      if (existing) {
        memberRecordId = existing.id;
      } else {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, fName: true, lName: true, phone: true, email: true, createdAt: true },
        });
        if (!user) return reply.code(404).send({ message: 'Member not found' });

        const created = await prisma.memberRecord.create({
          data: {
            memberKey: `user.${user.id}`,
            status: 'Member',
            firstName: user.fName ?? null,
            lastName: user.lName ?? null,
            joined: user.createdAt.toISOString(),
            phone: user.phone ?? null,
            email: user.email ?? null,
            userId: user.id,
            rawJson: '{}',
          } as any,
        });
        memberRecordId = created.id;
      }
    } else {
      // Try as MemberRecord.id first (spreadsheet-imported members).
      const existingRecord = await prisma.memberRecord.findUnique({ where: { id } });
      if (existingRecord) {
        memberRecordId = existingRecord.id;
      } else {
        // The id is a plain User.id — members added via the Add Member form.
        // mapUserAsMember returns id: user.id without any 'user.' prefix.
        const linkedRecord = await prisma.memberRecord.findFirst({ where: { userId: id } });
        if (linkedRecord) {
          memberRecordId = linkedRecord.id;
        } else {
          const user = await prisma.user.findUnique({
            where: { id },
            select: { id: true, fName: true, lName: true, phone: true, email: true, createdAt: true },
          });
          if (!user) return reply.code(404).send({ message: 'Member not found' });
          const created = await prisma.memberRecord.create({
            data: {
              memberKey: `user.${user.id}`,
              status: 'Member',
              firstName: user.fName ?? null,
              lastName: user.lName ?? null,
              joined: user.createdAt.toISOString(),
              phone: user.phone ?? null,
              email: user.email ?? null,
              userId: user.id,
              rawJson: '{}',
            } as any,
          });
          memberRecordId = created.id;
        }
      }
    }

    const due = await (prisma as any).monthlyDue.upsert({
      where: {
        memberRecordId_year_month: {
          memberRecordId,
          year: Body.year,
          month: Body.month,
        },
      },
      update: {
        duesPaid: Body.duesPaid as any,
        ...(Body.present !== undefined ? { present: Body.present } : {}),
      },
      create: {
        memberRecordId,
        year: Body.year,
        month: Body.month,
        duesPaid: Body.duesPaid as any,
        ...(Body.present !== undefined ? { present: Body.present } : {}),
      },
    });

    try {
      const record = await prisma.memberRecord.findUnique({
        where: { id: memberRecordId },
        select: { userId: true, monthlyDues: { select: { duesPaid: true } } },
      });
      if (record?.userId) {
        const totalPaid = record.monthlyDues.reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0);
        const outstanding = Math.max(0, (record.monthlyDues.length * 20) - totalPaid);
        await prisma.user.update({
          where: { id: record.userId },
          data: { totalPaid, outstanding },
        }).catch(() => null);
      }
    } catch {
      // Non-fatal sync error
    }

    return {
      id: due.id,
      year: due.year,
      month: due.month,
      duesPaid: decimalToNumber(due.duesPaid) ?? 0,
      present: due.present ?? null,
      createdAt: due.createdAt,
    };
  });

  // Delete a monthly due payment for a member.
  app.delete('/members/:id/monthly-dues/:dueId', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const dueId = String(req.params?.dueId ?? '');
    
    const existing = await (prisma as any).monthlyDue.findUnique({
      where: { id: dueId },
    });
    
    if (!existing) {
      return reply.code(404).send({ message: 'Payment record not found' });
    }

    const memberRecordId = existing.memberRecordId;

    await (prisma as any).monthlyDue.delete({
      where: { id: dueId },
    });

    if (memberRecordId) {
      try {
        const record = await prisma.memberRecord.findUnique({
          where: { id: memberRecordId },
          select: { userId: true, monthlyDues: { select: { duesPaid: true } } },
        });
        if (record?.userId) {
          const totalPaid = record.monthlyDues.reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0);
          const outstanding = Math.max(0, (record.monthlyDues.length * 20) - totalPaid);
          await prisma.user.update({
            where: { id: record.userId },
            data: { totalPaid, outstanding },
          }).catch(() => null);
        }
      } catch {
        // Non-fatal sync error
      }
    }
    
    return { ok: true };
  });

  // Edit (PATCH) a specific monthly due payment row.
  app.patch('/members/:id/monthly-dues/:dueId', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const dueId = String(req.params?.dueId ?? '');

    const Body = z.object({
      duesPaid: z.number().min(0).optional(),
      month: z.number().int().min(1).max(12).optional(),
      year: z.number().int().min(2000).max(2100).optional(),
    }).parse(req.body ?? {});

    const existing = await (prisma as any).monthlyDue.findUnique({ where: { id: dueId } });
    if (!existing) return reply.code(404).send({ message: 'Payment record not found' });

    const updated = await (prisma as any).monthlyDue.update({
      where: { id: dueId },
      data: {
        ...(Body.duesPaid !== undefined ? { duesPaid: Body.duesPaid as any } : {}),
        ...(Body.month !== undefined ? { month: Body.month } : {}),
        ...(Body.year !== undefined ? { year: Body.year } : {}),
      },
    });

    // Sync totalPaid / outstanding on the linked User
    const memberRecordId = existing.memberRecordId;
    if (memberRecordId) {
      try {
        const record = await prisma.memberRecord.findUnique({
          where: { id: memberRecordId },
          select: { userId: true, monthlyDues: { select: { duesPaid: true } } },
        });
        if (record?.userId) {
          const totalPaid = record.monthlyDues.reduce((sum, d) => sum + Number(d.duesPaid ?? 0), 0);
          const outstanding = Math.max(0, (record.monthlyDues.length * 20) - totalPaid);
          await prisma.user.update({
            where: { id: record.userId },
            data: { totalPaid, outstanding },
          }).catch(() => null);
        }
      } catch {
        // Non-fatal sync error
      }
    }

    return {
      id: updated.id,
      year: updated.year,
      month: updated.month,
      duesPaid: decimalToNumber(updated.duesPaid) ?? 0,
      present: updated.present ?? null,
      createdAt: updated.createdAt,
    };
  });

  // Record or update attendance for a member for a given year/month.
  // Attendance is stored as a single row per month (@@unique([year, month]))
  // with all present member IDs comma-separated in `usersIn`.
  // After each change we recompute and persist attendancePct on the MemberRecord
  // so GET /members always returns the live value.
  app.post('/members/:id/attendance', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const id = String(req.params?.id ?? '');

    const Body = z.object({
      year: z.number().int().min(2000).max(2100),
      month: z.number().int().min(1).max(12),
      status: z.enum(['present', 'absent']),
    }).parse(req.body ?? {});

    // Resolve the stable member identifier to store in usersIn AND the
    // MemberRecord to update attendancePct on. For plain User.id members
    // (no 'user.' prefix, mapUserAsMember), find or create a MemberRecord.
    let memberRecordId: string | null = null;
    let stableId: string;

    if (id.startsWith('user.')) {
      stableId = id.slice('user.'.length);
      const linked = await prisma.memberRecord.findFirst({ where: { userId: stableId } });
      memberRecordId = linked?.id ?? null;
    } else {
      const record = await prisma.memberRecord.findUnique({ where: { id }, select: { id: true } });
      if (record) {
        stableId = record.id;
        memberRecordId = record.id;
      } else {
        // Plain User.id (members added via the Add Member form).
        const user = await prisma.user.findUnique({
          where: { id },
          select: { id: true, fName: true, lName: true, phone: true, email: true, createdAt: true },
        });
        if (!user) return reply.code(404).send({ message: 'Member not found' });
        stableId = user.id;
        // Find or create a MemberRecord so attendancePct can be persisted.
        const linked = await prisma.memberRecord.findFirst({ where: { userId: user.id } });
        if (linked) {
          memberRecordId = linked.id;
        } else {
          const created = await prisma.memberRecord.create({
            data: {
              memberKey: `user.${user.id}`,
              status: 'Member',
              firstName: user.fName ?? null,
              lastName: user.lName ?? null,
              joined: user.createdAt.toISOString(),
              phone: user.phone ?? null,
              email: user.email ?? null,
              userId: user.id,
              rawJson: '{}',
            } as any,
          });
          memberRecordId = created.id;
        }
      }
    }

    // Fetch existing attendance row for this year/month (if any).
    const existing = await prismaAny.attendance.findUnique({
      where: { year_month: { year: Body.year, month: Body.month } },
    });

    let presentIds: string[] = existing
      ? existing.usersIn.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    if (Body.status === 'present') {
      if (!presentIds.includes(stableId)) presentIds.push(stableId);
    } else {
      presentIds = presentIds.filter((pid: string) => pid !== stableId);
    }

    const usersIn = presentIds.join(',');

    const saved = await prismaAny.attendance.upsert({
      where: { year_month: { year: Body.year, month: Body.month } },
      update: { usersIn },
      create: { year: Body.year, month: Body.month, usersIn },
    });

    // Also sync MonthlyDue table present flag if memberRecordId is available
    if (memberRecordId) {
      await prismaAny.monthlyDue.upsert({
        where: {
          memberRecordId_year_month: {
            memberRecordId,
            year: Body.year,
            month: Body.month,
          },
        },
        update: {
          present: Body.status === 'present',
        },
        create: {
          memberRecordId,
          year: Body.year,
          month: Body.month,
          present: Body.status === 'present',
          duesPaid: 0,
        },
      }).catch(() => null);
    }

    // Recompute this member's attendancePct across ALL attendance records
    // and write it back to MemberRecord so GET /members is always current.
    if (memberRecordId) {
      const candidateSet = new Set<string>();
      if (stableId) candidateSet.add(stableId.toLowerCase());
      if (memberRecordId) candidateSet.add(memberRecordId.toLowerCase());
      if (id) candidateSet.add(id.toLowerCase());

      const rec = await prisma.memberRecord.findUnique({
        where: { id: memberRecordId },
        select: { userId: true, memberKey: true, firstName: true, lastName: true },
      }).catch(() => null);

      if (rec) {
        if (rec.userId) {
          candidateSet.add(rec.userId.toLowerCase());
          candidateSet.add(`user.${rec.userId.toLowerCase()}`);
        }
        if (rec.memberKey) candidateSet.add(rec.memberKey.toLowerCase());
        const fullName = `${rec.firstName ?? ''} ${rec.lastName ?? ''}`.trim().toLowerCase();
        if (fullName) candidateSet.add(fullName);
      }

      const allAttendance = await prismaAny.attendance.findMany({ select: { usersIn: true } });
      const totalMeetings = allAttendance.length;
      let presentCount = 0;

      for (const a of allAttendance) {
        const usersInList = String(a.usersIn ?? '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        const isPresent = Array.from(candidateSet).some((cid) =>
          usersInList.some((u: string) => u === cid || u.includes(cid) || cid.includes(u))
        );
        if (isPresent) presentCount++;
      }

      const pct = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0;
      await prisma.memberRecord.update({
        where: { id: memberRecordId },
        data: { attendancePct: String(pct) },
      });
    }

    return {
      id: saved.id,
      year: saved.year,
      month: saved.month,
      status: Body.status,
      presentCount: presentIds.length,
    };
  });

  // Create a new user (admin)
  app.post('/users', { preHandler: requireRole('ADMIN') }, async (req) => {
    const Body = z.object({
      phone: z.string().min(1),
      email: z.string().email().transform((s) => s.toLowerCase().trim()),
      fName: z.string().min(1),
      lName: z.string().min(1),
      role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    }).parse(req.body);

    // Normalize the phone number so it is stored in a consistent format
    // that always matches what phoneLookupCandidates() generates at login.
    const normalizedPhone = normalizePhone(Body.phone);

    // Check if user already exists by phone (using all candidate formats) or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: phoneLookupCandidates(normalizedPhone) } },
          { email: Body.email },
        ],
      },
    });

    if (existingUser) {
      const err: any = new Error('User with this phone or email already exists');
      err.statusCode = 409;
      throw err;
    }

    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        email: Body.email,
        fName: Body.fName,
        lName: Body.lName,
        role: Body.role,
        status: 'Active',
        // Explicitly mark as needing password change so first login
        // uses the temporary password (last name in block letters).
        needsPasswordChange: true,
        passwordHash: null,
      },
      select: {
        id: true,
        phone: true,
        email: true,
        fName: true,
        lName: true,
        role: true,
        status: true,
        needsPasswordChange: true,
        createdAt: true,
      },
    });

    await prisma.memberRecord.create({
      data: {
        memberKey: `user.${user.id}`,
        status: 'Member',
        firstName: user.fName,
        lastName: user.lName,
        joined: user.createdAt.toISOString(),
        phone: user.phone,
        email: user.email,
        voter: 'No',
        rawJson: JSON.stringify({
          Status: 'Member',
          First: user.fName ?? '',
          Last: user.lName ?? '',
          Joined: user.createdAt.toISOString(),
          Phone: user.phone,
          Email: user.email ?? '',
          Voter: 'No',
        }),
        userId: user.id,
      } as any,
    });

    return user;
  });
};