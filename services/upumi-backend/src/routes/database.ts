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
  dues: 'due',
  collections: 'collection',
  transactions: 'transaction',
  expenses: 'expense',
  memberFinance: 'memberFinance',
} as const;

type TableName = keyof typeof TABLES;

const tableNames = Object.keys(TABLES) as [TableName, ...TableName[]];
const TableParamSchema = z.object({ table: z.enum(tableNames) });
const IdParamSchema = TableParamSchema.extend({ id: z.string().min(1) });

const RoleSchema = z.enum(['ADMIN', 'MEMBER', 'Admin', 'Member']).transform((v) => v.toUpperCase());
const VoteRoleSchema = z.enum(['Yes', 'No']).default('No');
const StatusSchema = z.enum(['Active', 'Inactive']).default('Active');
const TransactionTitleSchema = z.enum(['Raffle', 'Insurance', 'Wrapper', 'UPUA 25 Raffle', 'Levy']);

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
      if (!partial) z.object({ userId: z.string().min(1), year: z.any(), month: z.any(), amount: z.any() }).parse(body);
      return { ...pick('userId', String), ...pick('year', year), ...pick('month', month), ...pick('amount', money) };
    case 'collections':
      if (!partial) z.object({ event: z.string().min(1), amountPaid: z.any() }).parse(body);
      return { ...pick('event', String), ...pick('amountPaid', money) };
    case 'transactions': {
      if (!partial) z.object({ title: z.any(), amount: z.any(), date: z.any() }).parse(body);
      const data: Record<string, any> = {
        ...pick('userId', String),
        ...pick('fullName', String),
        ...pick('title', (v) => TransactionTitleSchema.parse(v)),
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

async function listRows(table: TableName) {
  return prismaAny[TABLES[table]].findMany({
    orderBy: { createdAt: 'desc' },
    ...(selectFor(table) ? { select: selectFor(table) } : {}),
  });
}

export const adminDatabaseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:table', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table } = TableParamSchema.parse(req.params);
    return listRows(table);
  });

  app.post('/:table', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table } = TableParamSchema.parse(req.params);
    const data = await sanitizeData(table, req.body ?? {});
    return prismaAny[TABLES[table]].create({ data, ...(selectFor(table) ? { select: selectFor(table) } : {}) });
  });

  app.patch('/:table/:id', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table, id } = IdParamSchema.parse(req.params);
    const data = await sanitizeData(table, req.body ?? {}, true);
    return prismaAny[TABLES[table]].update({
      where: { id },
      data,
      ...(selectFor(table) ? { select: selectFor(table) } : {}),
    });
  });

  app.delete('/:table/:id', { preHandler: requireRole('ADMIN') }, async (req: any) => {
    const { table, id } = IdParamSchema.parse(req.params);
    await prismaAny[TABLES[table]].delete({ where: { id } });
    return { ok: true };
  });
};

export const memberDatabaseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:table', { preHandler: requireAuth }, async (req: any) => {
    const { table } = TableParamSchema.parse(req.params);
    return listRows(table);
  });
};
