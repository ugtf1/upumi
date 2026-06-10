import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../services/auth.js';
import { prisma } from '../services/prisma.js';
import { importWorkbookCsv, toSheetCsvExportUrl } from '../services/workbookImport.js';

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

export const adminRoutes: FastifyPluginAsync = async (app) => {
  const prismaAny = prisma as any;
  // List all members (admin)
  app.get('/members', { preHandler: requireRole('ADMIN') }, async () => {
    return prisma.memberRecord.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        goodStanding: true,
        financialGoodStanding: true,
        voter: true,
        attendancePct: true,
        userId: true,
        updatedAt: true,
      },
    });
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

  // Create a new user (admin)
  app.post('/users', { preHandler: requireRole('ADMIN') }, async (req) => {
    const Body = z.object({
      phone: z.string().min(1),
      email: z.string().email().transform((s) => s.toLowerCase().trim()),
      fName: z.string().min(1),
      lName: z.string().min(1),
      role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
    }).parse(req.body);

    // Check if user already exists by phone or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: Body.phone },
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
        phone: Body.phone,
        email: Body.email,
        fName: Body.fName,
        lName: Body.lName,
        role: Body.role,
        status: 'Active',
      },
      select: {
        id: true,
        phone: true,
        email: true,
        fName: true,
        lName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return user;
  });
};
