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
  dues: 'monthlyDue',
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
    case 'memberYearlyBalances':
      if (!partial) {
        z.object({ memberRecordId: z.string().min(1), year: z.number() }).parse(body);
      }
      return {
        ...pick('memberRecordId', String),
        ...pick('year', Number),
        ...pick('balance', money),
      };
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
      duesPaid: { gt: 0 },
    };
    args.include = {
      member: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          user: {
            select: {
              fName: true,
              lName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    };
  }

  try {
    return await delegate.findMany(args);
  } catch (error) {
    if (table === 'transactions' && isMissingTransactionDescriptionColumn(error)) {
      return delegate.findMany({
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

async function syncTransactionDuesToMonthlyDue(data: Record<string, any>) {
  try {
    const titleStr = String(data.title ?? '').toLowerCase();
    if (!titleStr.includes('dues')) return;

    const amount = Number(data.amount ?? 0);
    if (amount <= 0) return;

    const txDate = data.date ? new Date(data.date) : new Date();
    const year = txDate.getFullYear();
    const month = txDate.getMonth() + 1;

    let memberRecordId: string | null = null;
    if (data.userId) {
      const mr = await prisma.memberRecord.findFirst({ where: { userId: data.userId } });
      if (mr) memberRecordId = mr.id;
    }
    if (!memberRecordId && data.fullName) {
      const normName = String(data.fullName).trim().toLowerCase();
      const allMR = await prisma.memberRecord.findMany({ select: { id: true, firstName: true, lastName: true } });
      const match = allMR.find((mr) => `${mr.firstName ?? ''} ${mr.lastName ?? ''}`.trim().toLowerCase() === normName);
      if (match) memberRecordId = match.id;
    }

    if (!memberRecordId) return;

    await prisma.monthlyDue.upsert({
      where: {
        memberRecordId_year_month: { memberRecordId, year, month },
      },
      update: { duesPaid: amount },
      create: { memberRecordId, year, month, duesPaid: amount },
    });
  } catch {
    // Best effort sync
  }
}

async function createRow(table: TableName, data: Record<string, any>) {
  const delegate = prismaAny[TABLES[table]];

  try {
    const created = await delegate.create({ data, ...(selectFor(table) ? { select: selectFor(table) } : {}) });
    if (table === 'transactions') {
      await syncTransactionDuesToMonthlyDue(data);
    }
    return created;
  } catch (error) {
    if (table === 'transactions' && isMissingTransactionDescriptionColumn(error)) {
      const { description: _description, ...dataWithoutDescription } = data;
      const created = await delegate.create({ data: dataWithoutDescription, select: transactionSelectWithoutDescription });
      await syncTransactionDuesToMonthlyDue(dataWithoutDescription);
      return created;
    }
    throw error;
  }
}

async function updateRow(table: TableName, id: string, data: Record<string, any>) {
  const delegate = prismaAny[TABLES[table]];

  try {
    const updated = await delegate.update({
      where: { id },
      data,
      ...(selectFor(table) ? { select: selectFor(table) } : {}),
    });
    if (table === 'transactions') {
      await syncTransactionDuesToMonthlyDue(updated);
    }
    return updated;
  } catch (error) {
    if (table === 'transactions' && isMissingTransactionDescriptionColumn(error)) {
      const { description: _description, ...dataWithoutDescription } = data;
      const updated = await delegate.update({
        where: { id },
        data: dataWithoutDescription,
        select: transactionSelectWithoutDescription,
      });
      await syncTransactionDuesToMonthlyDue(updated);
      return updated;
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

export const memberDatabaseRoutes: FastifyPluginAsync = async (app) => {
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
