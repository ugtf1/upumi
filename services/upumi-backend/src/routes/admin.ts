import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../services/auth.js';
import { prisma } from '../services/prisma.js';
import { parse } from 'csv-parse/sync';

const ImportSchema = z.object({
  csvText: z.string().min(1),
  year: z.number().int().min(2000).max(2100).default(2025),
});

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // List all members (admin)
  app.get('/members', { preHandler: requireRole('ADMIN') }, async () => {
    return prisma.memberRecord.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
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
    const records = parse(body.csvText, { columns: true, skip_empty_lines: true });

    let upserted = 0;
    for (const r of records) {
      const email = (r['Email'] ?? '').toString().trim().toLowerCase() || null;

      const data = {
        status: r['Status'] ?? null,
        title: r['Title'] ?? null,
        lastName: r['Last'] ?? null,
        firstName: r['First'] ?? null,
        joined: r['Joined'] ?? null,
        phone: r['Phone2'] ?? null,
        email,
        whatsapp: r['Whatsapp'] ?? null,
        facebook: r['facebook'] ?? null,
        goodStanding: r['GoodStanding'] ?? null,
        financialGoodStanding: r['Financial GoodStanding'] ?? null,
        voter: r['Voter'] ?? null,
        insurance: r['Insurance?'] ?? null,
        attendancePct: r['%Attendance'] ?? null,
        rawJson: r,
      };

      // If email exists, upsert on email; otherwise create a new row.
      if (email) {
        const user = await prisma.user.findUnique({ where: { email } });
        await prisma.memberRecord.upsert({
          where: { email },
          update: { ...data, userId: user?.id ?? null },
          create: { ...data, userId: user?.id ?? null },
        });
        upserted += 1;
      } else {
        await prisma.memberRecord.create({ data });
        upserted += 1;
      }
    }

    return reply.send({ imported: upserted });
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
      select: { id: true, userId: true, email: true, firstName: true, lastName: true },
    });
  });
};
