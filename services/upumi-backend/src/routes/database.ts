import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { requireAuth, requireRole } from '../services/auth.js';
import { normalizePhone } from '../services/phone.js';

const prismaAny = prisma as any;

const TABLES = {
  users: 'user',
  generalFinance: 'generalFinance',
  attendance: 'attendance',
  hostingSchedule: 'hostingSchedule',
  dues: 'transaction',
  collections: 'collection',
  transactions: 'transaction',
  expenses: 'expense',
  memberFinance: 'memberFinance',
  yearlyBalances: 'yearlyBalance',
  memberYearlyBalances: 'memberYearlyBalance',
} as const;

type TableName = keyof typeof TABLES;

const tableNames = Object.keys(TABLES) as [TableName, ...TableName[]];
const TableParamSchema = z.object({ table: z.enum(tableNames) });
const IdParamSchema = TableParamSchema.extend({ id: z.string().min(1) });

const RoleSchema = z.enum(['ADMIN', 'MEMBER', 'Admin', 'Member']).transform((v) => v.toUpperCase());
const VoteRoleSchema = z.enum(['Yes', 'No']).default('No');
const StatusSchema = z.enum(['Active', 'Inactive']).default('Active');
const TransactionTitleSchema = z.enum(['Raffle', 'Insurance', 'Wrapper', 'UPUA 25 Raffle', 'Levy', 'Others', 'Dues']);
const transactionSelectWithoutDescription = {
  id: true,
  userId: true,
  fullName: true,
  title: true,
  amount: true,
  date: true,
  createdAt: true,
  updatedAt: true,
};

function money(v: unknown) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) throw new Error('Invalid amount');
  return n;
}

function month(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error('Month must be between 1 and 12');
  return n;
}

function year(v: unknown) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error('Year must be between 2000 and 2100');
  return n;
}

function date(v: unknown) {
  if (!v) return undefined;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return d;
}

async function fullNameForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fName: true, lName: true, phone: true },
  });
  if (!user) throw new Error('User not found');
  return [user.fName, user.lName].filter(Boolean).join(' ') || user.phone;
}

async function resolveMemberRecordId(rawId: string): Promise<string> {
  // 1. Direct match on MemberRecord.id
  const direct = await prisma.memberRecord.findUnique({
    where: { id: rawId },
    select: { id: true },
  }).catch(() => null);
  if (direct) return direct.id;

  // 2. Match on userId or memberKey
  const byUserOrKey = await prisma.memberRecord.findFirst({
    where: {
      OR: [
        { userId: rawId },
        { memberKey: rawId },
        { memberKey: `user.${rawId}` },
      ],
    },
    select: { id: true },
  }).catch(() => null);
  if (byUserOrKey) return byUserOrKey.id;

  // 3. If rawId is a User.id, create or link a MemberRecord for that User
  const user = await prisma.user.findUnique({
    where: { id: rawId },
  }).catch(() => null);

  if (user) {
    const created = await prisma.memberRecord.create({
      data: {
        userId: user.id,
        memberKey: `user.${user.id}`,
        firstName: user.fName ?? '',
        lastName: user.lName ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        joined: user.dateJoined ? String(user.dateJoined) : null,
        status: user.status ?? 'Active',
        rawJson: JSON.stringify({}),
      },
      select: { id: true },
    });
    return created.id;
  }

  return rawId;
}

async function sanitizeData(table: TableName, body: any, partial = false) {
  const present = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const pick = (key: string, convert = (v: any) => v) =>
    present(key) ? { [key]: convert(body[key]) } : {};

  switch (table) {
    case 'users': {
      if (!partial) {
        z.object({ phone: z.string().min(7) }).parse(body);
      }
      return {
        ...pick('phone', normalizePhone),
        ...pick('role', (v) => RoleSchema.parse(v)),
        ...pick('email', (v) => (String(v).trim() ? String(v).trim().toLowerCase() : null)),
        ...pick('fName', String),
        ...pick('lName', String),
        ...pick('dateJoined', date),
        ...pick('voteRole', (v) => VoteRoleSchema.parse(v)),
        ...pick('address', String),
        ...pick('monthlyDues', money),
        ...pick('totalPaid', money),
        ...pick('outstanding', money),
        ...pick('status', (v) => StatusSchema.parse(v)),
      };
    }
    case 'generalFinance':
      return {
        ...pick('totalMembers', Number),
        ...pick('activeMembers', Number),
        ...pick('totalRevenue', money),
        ...pick('pendingPayments', money),
        ...pick('incomeYtd', money),
        ...pick('expensesYtd', money),
        ...pick('bussinessAccount', money),
        ...pick('fundraiserAccount', money),
        ...pick('totalAccBalance', money),
        ...pick('year', year),
      };
    case 'attendance':
      if (!partial) z.object({ year: z.any(), month: z.any(), usersIn: z.string() }).parse(body);
      return { ...pick('year', year), ...pick('month', month), ...pick('usersIn', String) };
    case 'hostingSchedule':
      if (!partial) z.object({ year: z.any(), month: z.any(), hostMember: z.string() }).parse(body);
      return { ...pick('year', year), ...pick('month', month), ...pick('hostMember', String) };
    case 'dues':
      if (!partial) z.object({ memberRecordId: z.string().min(1), year: z.any(), month: z.any(), duesPaid: z.any() }).parse(body);
      return {
        ...pick('memberRecordId', String),
        ...pick('year', year),
        ...pick('month', month),
        ...pick('duesPaid', money),
        ...pick('present', (v) => v === true || v === 'true'),
      };
    case 'collections':
      if (!partial) z.object({ event: z.string().min(1), amountPaid: z.any() }).parse(body);
      return { ...pick('event', String), ...pick('amountPaid', money) };
    case 'transactions': {
      if (!partial) z.object({ title: z.any(), amount: z.any(), date: z.any() }).parse(body);
      const data: Record<string, any> = {
        ...pick('userId', String),
        ...pick('fullName', String),
        ...pick('title', (v) => TransactionTitleSchema.parse(v)),
        ...pick('description', (v) => (v == null ? null : String(v))),
        ...pick('amount', money),
        ...pick('date', date),
      };
      if (!data.fullName && data.userId) data.fullName = await fullNameForUser(data.userId);
      return data;
    }
    case 'expenses':
      if (!partial) z.object({ reason: z.string().min(1), title: z.string().min(1), amount: z.any(), date: z.any() }).parse(body);
      return { ...pick('reason', String), ...pick('title', String), ...pick('amount', money), ...pick('date', date) };
    case 'memberFinance':
      if (!partial) z.object({ userId: z.string().min(1) }).parse(body);
      return {
        ...pick('userId', String),
        ...pick('monthlyDues', money),
        ...pick('totalPaid', money),
        ...pick('outstanding', money),
      };
    case 'yearlyBalances':
      if (!partial) {
        z.object({ year: z.number() }).parse(body);
      }
      return {
        ...pick('year', Number),
        ...pick('balance', money),
      };
    case 'memberYearlyBalances': {
      if (!partial) {
        z.object({ memberRecordId: z.string().min(1), year: z.number() }).parse(body);
      }
      let memberRecordId = body.memberRecordId ? String(body.memberRecordId) : undefined;
      if (memberRecordId) {
        memberRecordId = await resolveMemberRecordId(memberRecordId);
      }
      return {
        ...(memberRecordId ? { memberRecordId } : {}),
        ...pick('year', Number),
        ...pick('balance', money),
      };
    }
    default:
      return {};
  }
}

function selectFor(table: TableName) {
  if (table !== 'users') return undefined;
  return {
    id: true,
    phone: true,
    role: true,
    email: true,
    fName: true,
    lName: true,
    dateJoined: true,
    voteRole: true,
    address: true,
    monthlyDues: true,
    totalPaid: true,
    outstanding: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  };
}

function isMissingTransactionDescriptionColumn(error: unknown) {
  const candidate = error as { code?: string; message?: string; meta?: { column?: string } };
  return (
    candidate?.code === 'P2022' &&
    (candidate.meta?.column === 'transactions.description' ||
      String(candidate.message ?? '').includes('transactions.description'))
  );
}

async function listRows(table: TableName) {
  const delegate = prismaAny[TABLES[table]];
  const args: any = {
    orderBy: { createdAt: 'desc' },
    ...(selectFor(table) ? { select: selectFor(table) } : {}),
  };

  if (table === 'dues') {
    args.where = {
      title: { contains: 'Dues', mode: 'insensitive' },
    };
  }

  try {
    return await delegate.findMany(args);
  } catch (error) {
    if ((table === 'transactions' || table === 'dues') && isMissingTransactionDescriptionColumn(error)) {
      return delegate.findMany({
        where: args.where,
        orderBy: { createdAt: 'desc' },
        select: transactionSelectWithoutDescription,
      });
    }
    // P2021: table does not exist (migration not yet applied) — return empty list
    // rather than crashing the whole request with a 500.
    const prismaErr = error as { code?: string };
    if (prismaErr?.code === 'P2021') {
      console.warn(`[database] Table for "${table}" does not exist yet (P2021). Returning [].`);
      return [];
    }
    throw error;
  }
}

async function createRow(table: TableName, data: Record<string, any>) {
  const delegate = prismaAny[TABLES[table]];

  if (table === 'memberYearlyBalances' && data.memberRecordId && data.year != null) {
    return await delegate.upsert({
      where: {
        memberRecordId_year: {
          memberRecordId: data.memberRecordId,
          year: data.year,
        },
      },
      update: {
        balance: data.balance ?? 0,
      },
      create: data,
    });
  }

  try {
    return await delegate.create({ data, ...(selectFor(table) ? { select: selectFor(table) } : {}) });
  } catch (error) {
    if ((table === 'transactions' || table === 'dues') && isMissingTransactionDescriptionColumn(error)) {
      const { description: _description, ...dataWithoutDescription } = data;
      return await delegate.create({ data: dataWithoutDescription, select: transactionSelectWithoutDescription });
    }
    throw error;
  }
}

async function updateRow(table: TableName, id: string, data: Record<string, any>) {
  const delegate = prismaAny[TABLES[table]];

  try {
    return await delegate.update({
      where: { id },
      data,
      ...(selectFor(table) ? { select: selectFor(table) } : {}),
    });
  } catch (error) {
    if ((table === 'transactions' || table === 'dues') && isMissingTransactionDescriptionColumn(error)) {
      const { description: _description, ...dataWithoutDescription } = data;
      return await delegate.update({
        where: { id },
        data: dataWithoutDescription,
        select: transactionSelectWithoutDescription,
      });
    }
    throw error;
  }
}

export const adminDatabaseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:table', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table } = TableParamSchema.parse(req.params);
    return listRows(table);
  });

  app.post('/:table', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table } = TableParamSchema.parse(req.params);
    const data = await sanitizeData(table, req.body ?? {});
    return createRow(table, data);
  });

  app.patch('/:table/:id', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table, id } = IdParamSchema.parse(req.params);
    const data = await sanitizeData(table, req.body ?? {}, true);
    return updateRow(table, id, data);
  });

  app.delete('/:table/:id', { preHandler: requireRole('ADMIN') }, async (req: any, reply) => {
    const { table, id } = IdParamSchema.parse(req.params);
    const delegate = prismaAny[TABLES[table]];
    if (!delegate) return reply.code(400).send({ message: `Unknown table: ${table}` });

    try {
      const existing = await delegate.findUnique({ where: { id } }).catch(() => null);
      if (!existing) {
        return reply.code(404).send({ message: `Record not found in ${table}` });
      }
      await delegate.delete({ where: { id } });
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({ message: `Failed to delete from ${table}: ${msg}` });
    }
  });
};

function parseRawJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
  } catch {
    return {};
  }
}

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

function computeFinancialGoodStanding(balanceValue: number | null | undefined, fallbackValue?: string | null): string {
  if (balanceValue !== null && balanceValue !== undefined && Number.isFinite(Number(balanceValue))) {
    return Number(balanceValue) <= -240 ? 'No' : 'Yes';
  }
  if (fallbackValue) {
    const v = String(fallbackValue).trim().toLowerCase();
    if (v === 'no' || v === 'bad' || v === 'inactive' || v === 'false' || v === '0') return 'No';
    if (v === 'yes' || v === 'good' || v === 'active' || v === 'true' || v === '1') return 'Yes';
    const num = Number(v.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(num)) return num <= -240 ? 'No' : 'Yes';
  }
  return 'Yes';
}

async function searchMembers(queryTerm?: string) {
  const currentYearNum = new Date().getFullYear();
  const currentMonthNum = new Date().getMonth() + 1;
  const expectedDuesSoFar = currentMonthNum * 20;

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
      status: true,
      dateJoined: true,
      voteRole: true,
    },
  });

  const allYearlyBalances = await prismaAny.memberYearlyBalance.findMany({
    select: { memberRecordId: true, year: true, balance: true },
  }).catch(() => []);

  const hostingSchedules = await prisma.hostingSchedule.findMany({
    select: { year: true, month: true, hostMember: true },
  }).catch(() => []);

  const allTransactions = await prisma.transaction.findMany({
    select: { userId: true, fullName: true, title: true, amount: true },
  }).catch(() => []);

  const MONTH_ABBRS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatHostingDate(rawHosting?: string | null, fullName?: string): string {
    if (fullName && hostingSchedules.length > 0) {
      const lowerName = fullName.toLowerCase().trim();
      const tokens = lowerName.split(/\s+/).filter((p: string) => p.length >= 2);
      const sched = hostingSchedules.find((h: any) => {
        const lowerHost = (h.hostMember || '').toLowerCase().trim();
        if (!lowerHost) return false;
        if (lowerHost.includes(lowerName) || lowerName.includes(lowerHost)) return true;
        if (tokens.length > 0 && tokens.every((t: string) => lowerHost.includes(t))) return true;
        return false;
      });
      if (sched && sched.year && sched.month) {
        const mStr = MONTH_ABBRS[sched.month - 1] || 'Jan';
        return `${mStr}, ${sched.year}`;
      }
    }
    if (!rawHosting || rawHosting === '-' || rawHosting === 'None') return 'None';
    if (rawHosting.includes(',') && !rawHosting.includes('-')) return rawHosting;
    const d = new Date(rawHosting);
    if (!Number.isNaN(d.getTime())) {
      const mStr = MONTH_ABBRS[d.getMonth()];
      return `${mStr}, ${d.getFullYear()}`;
    }
    return rawHosting;
  }

  function calculateMemberTxTotals(userId: string | null | undefined, fullName: string) {
    const lowerName = fullName.toLowerCase().trim();
    const userTxs = allTransactions.filter((t: any) => {
      if (userId && t.userId === userId) return true;
      if (t.fullName && lowerName && t.fullName.toLowerCase().trim() === lowerName) return true;
      return false;
    });

    let duesSum = 0;
    for (const t of userTxs) {
      const amt = Number(t.amount ?? 0);
      const title = (t.title || '').toLowerCase().trim();
      if (title.includes('due')) duesSum += amt;
    }
    return { crntPaid: duesSum };
  }

  const mappedMemberRecords = rows.map((row: any) => {
    const raw = parseRawJson(row.rawJson);
    const firstName = strCell(row.firstName) ?? strCell(row.user?.fName) ?? strCell(raw.First) ?? '';
    const lastName = strCell(row.lastName) ?? strCell(row.user?.lName) ?? strCell(raw.Last) ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    const phone = strCell(row.phone) ?? strCell(row.user?.phone) ?? strCell(raw.Phone) ?? null;
    const email = strCell(row.email) ?? strCell(row.user?.email) ?? strCell(raw.Email) ?? null;
    const status = strCell(row.status) ?? strCell(row.user?.status) ?? 'Active';
    const voter = strCell(row.voter) ?? strCell(row.user?.voteRole) ?? strCell(raw.Voter) ?? 'No';
    const joined = strCell(row.joined) ?? strCell(raw.Joined) ?? (row.user?.dateJoined ? new Date(row.user.dateJoined).toISOString().slice(0, 10) : null);
    const attendancePct = strCell(row.attendancePct) ?? strCell(raw.AttendancePct) ?? '0%';

    const txTotals = calculateMemberTxTotals(row.userId, fullName);
    const memberBalances = allYearlyBalances.filter((b: any) => b.memberRecordId === row.id);
    let yearlyBalancesSum = 0;
    if (memberBalances.length > 0) {
      yearlyBalancesSum = memberBalances.reduce((acc: number, b: any) => acc + Number(b.balance ?? 0), 0);
    } else {
      yearlyBalancesSum = rawMoney(raw, ['2026 balance', '2025 balance', '2024 balance', 'balance', 'Balance']) ?? 0;
    }

    const outstanding = txTotals.crntPaid - expectedDuesSoFar;
    const balance = yearlyBalancesSum + outstanding;
    const financialGoodStanding = computeFinancialGoodStanding(balance, strCell(row.financialGoodStanding) ?? strCell(raw['Financial Good Standing']));
    const goodStanding = strCell(row.goodStanding) ?? strCell(raw['Good Standing']) ?? financialGoodStanding;
    const hosting = formatHostingDate(strCell(raw.Hosting) ?? strCell(raw.hosting), fullName);

    return {
      id: row.id,
      memberId: row.memberKey || row.id,
      name: fullName || email || phone || 'Unnamed Member',
      firstName,
      lastName,
      email,
      phone,
      status,
      goodStanding,
      financialGoodStanding,
      voter,
      attendancePct,
      hosting,
      balance: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      balanceRaw: balance,
      outstanding: `$${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      outstandingRaw: outstanding,
      dateJoined: joined,
    };
  });

  const mappedUserOnly = userOnlyRows.map((user: any) => {
    const firstName = user.fName ?? '';
    const lastName = user.lName ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    const phone = user.phone ?? null;
    const email = user.email ?? null;
    const status = user.status ?? 'Active';
    const voter = user.voteRole ?? 'No';
    const joined = user.dateJoined ? new Date(user.dateJoined).toISOString().slice(0, 10) : null;
    const txTotals = calculateMemberTxTotals(user.id, fullName);
    const outstanding = txTotals.crntPaid - expectedDuesSoFar;
    const balance = outstanding;
    const financialGoodStanding = computeFinancialGoodStanding(balance);
    const hosting = formatHostingDate(null, fullName);

    return {
      id: user.id,
      memberId: user.id,
      name: fullName || email || phone || 'Unnamed Member',
      firstName,
      lastName,
      email,
      phone,
      status,
      goodStanding: financialGoodStanding,
      financialGoodStanding,
      voter,
      attendancePct: '0%',
      hosting,
      balance: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      balanceRaw: balance,
      outstanding: `$${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      outstandingRaw: outstanding,
      dateJoined: joined,
    };
  });

  const allMembers = [...mappedMemberRecords, ...mappedUserOnly];

  if (!queryTerm || !queryTerm.trim() || queryTerm.trim().toLowerCase() === 'all') {
    return allMembers;
  }

  const q = queryTerm.trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);

  return allMembers.filter((m) => {
    const haystack = [
      m.name,
      m.firstName,
      m.lastName,
      m.email ?? '',
      m.phone ?? '',
      m.status,
      m.memberId,
      m.goodStanding,
      m.financialGoodStanding,
      m.hosting,
    ].join(' ').toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

async function getAttendanceHistory(memberId?: string, eventId?: string) {
  const attendanceRows = await prisma.attendance.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (memberId && memberId.trim()) {
    const rawMemberId = memberId.trim();
    const lowerMemberId = rawMemberId.toLowerCase();

    const memberRecord = await prisma.memberRecord.findFirst({
      where: {
        OR: [
          { id: rawMemberId },
          { memberKey: rawMemberId },
          { userId: rawMemberId },
          { firstName: { equals: rawMemberId, mode: 'insensitive' } },
          { lastName: { equals: rawMemberId, mode: 'insensitive' } },
        ],
      },
      include: { user: true },
    }).catch(() => null);

    const candidateIds: string[] = [lowerMemberId];
    let memberName = '';
    let displayId = rawMemberId;
    let memberObj: any = null;

    if (memberRecord) {
      displayId = memberRecord.memberKey || memberRecord.id;
      const fn = memberRecord.firstName || memberRecord.user?.fName || '';
      const ln = memberRecord.lastName || memberRecord.user?.lName || '';
      memberName = `${fn} ${ln}`.trim().toLowerCase();
      candidateIds.push(memberRecord.id.toLowerCase());
      candidateIds.push(memberRecord.memberKey.toLowerCase());
      if (memberRecord.userId) candidateIds.push(memberRecord.userId.toLowerCase());
      if (memberRecord.user?.id) candidateIds.push(memberRecord.user.id.toLowerCase());
      memberObj = {
        id: memberRecord.id,
        memberId: displayId,
        name: `${fn} ${ln}`.trim() || displayId,
        email: memberRecord.email || memberRecord.user?.email || null,
        phone: memberRecord.phone || memberRecord.user?.phone || null,
        status: memberRecord.status || memberRecord.user?.status || 'Active',
      };
    } else {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: rawMemberId },
            { phone: rawMemberId },
            { email: rawMemberId },
            { fName: { equals: rawMemberId, mode: 'insensitive' } },
            { lName: { equals: rawMemberId, mode: 'insensitive' } },
          ],
        },
      }).catch(() => null);

      if (user) {
        displayId = user.id;
        memberName = `${user.fName ?? ''} ${user.lName ?? ''}`.trim().toLowerCase();
        candidateIds.push(user.id.toLowerCase());
        memberObj = {
          id: user.id,
          memberId: user.id,
          name: `${user.fName ?? ''} ${user.lName ?? ''}`.trim() || user.phone,
          email: user.email,
          phone: user.phone,
          status: user.status,
        };
      } else {
        memberName = lowerMemberId;
      }
    }

    let rowsToInspect = attendanceRows;
    if (eventId && eventId.trim()) {
      const evLower = eventId.trim().toLowerCase();
      rowsToInspect = rowsToInspect.filter((att) => {
        const matchId = att.id.toLowerCase() === evLower;
        const matchYm = `${att.year}-${att.month}` === evLower || `${att.year}-${String(att.month).padStart(2, '0')}` === evLower;
        const mName = (MONTH_NAMES[att.month - 1] || '').toLowerCase();
        const matchName = evLower.includes(mName) && evLower.includes(String(att.year));
        return matchId || matchYm || matchName;
      });
    }

    let attendedCount = 0;
    const history = rowsToInspect.map((att) => {
      const usersInList = String(att.usersIn ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const attended =
        candidateIds.some((cid) => usersInList.includes(cid)) ||
        (memberName.length > 0 && usersInList.some((u) => u.includes(memberName) || memberName.includes(u)));
      if (attended) attendedCount++;

      return {
        eventId: att.id,
        year: att.year,
        month: att.month,
        monthName: MONTH_NAMES[att.month - 1] || `Month ${att.month}`,
        meetingDate: `${MONTH_NAMES[att.month - 1] || att.month} ${att.year}`,
        attended,
        totalAttendees: usersInList.length,
      };
    });

    const total = rowsToInspect.length;
    const pct = total > 0 ? `${Math.round((attendedCount / total) * 100)}%` : '0%';

    return {
      member: memberObj || { memberId: displayId, name: memberName || displayId },
      totalMeetings: total,
      meetingsAttended: attendedCount,
      attendanceRate: pct,
      history,
    };
  }

  if (eventId && eventId.trim()) {
    const evLower = eventId.trim().toLowerCase();
    const matched = attendanceRows.filter((att) => {
      const matchId = att.id.toLowerCase() === evLower;
      const matchYm = `${att.year}-${att.month}` === evLower || `${att.year}-${String(att.month).padStart(2, '0')}` === evLower;
      const mName = (MONTH_NAMES[att.month - 1] || '').toLowerCase();
      const matchName = evLower.includes(mName) && evLower.includes(String(att.year));
      return matchId || matchYm || matchName;
    });

    return matched.map((att) => {
      const usersInList = String(att.usersIn ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      return {
        eventId: att.id,
        year: att.year,
        month: att.month,
        monthName: MONTH_NAMES[att.month - 1] || `Month ${att.month}`,
        meetingDate: `${MONTH_NAMES[att.month - 1] || att.month} ${att.year}`,
        totalAttendees: usersInList.length,
        attendees: usersInList,
      };
    });
  }

  return attendanceRows.map((att) => {
    const usersInList = String(att.usersIn ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return {
      eventId: att.id,
      year: att.year,
      month: att.month,
      monthName: MONTH_NAMES[att.month - 1] || `Month ${att.month}`,
      meetingDate: `${MONTH_NAMES[att.month - 1] || att.month} ${att.year}`,
      totalAttendees: usersInList.length,
    };
  });
}

export const memberDatabaseRoutes: FastifyPluginAsync = async (app) => {
  // Search members endpoint (used by AI assistant and integrations)
  app.get('/search', { preHandler: requireAuth }, async (req: any) => {
    const q = req.query?.q ? String(req.query.q) : '';
    return searchMembers(q);
  });

  // Attendance history endpoint (used by AI assistant and integrations)
  app.get('/attendance', { preHandler: requireAuth }, async (req: any) => {
    const memberId = req.query?.memberId ? String(req.query.memberId) : undefined;
    const eventId = req.query?.eventId ? String(req.query.eventId) : undefined;
    return getAttendanceHistory(memberId, eventId);
  });

  app.get('/:table', { preHandler: requireAuth }, async (req: any, reply) => {
    const { table } = TableParamSchema.parse(req.params);

    // Member yearly balances: scope to only this member's records
    if (table === 'memberYearlyBalances') {
      const memberRecord = await prisma.memberRecord.findFirst({
        where: { userId: req.user.sub },
        select: { id: true },
      });
      if (!memberRecord) return [];
      return prismaAny.memberYearlyBalance.findMany({
        where: { memberRecordId: memberRecord.id },
        orderBy: { year: 'desc' },
      });
    }

    return listRows(table);
  });
};

