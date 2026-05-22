import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../services/auth.js';
import { prisma } from '../services/prisma.js';

// Routes for normal users (scoped to themselves)
export const memberRoutes: FastifyPluginAsync = async (app) => {
  app.get('/my-dues', { preHandler: requireAuth }, async (req) => {
    const record = await prisma.memberRecord.findFirst({
      where: { userId: req.user.sub },
      select: { id: true },
    });
    if (!record) return { dues: [] };

    const dues = await prisma.monthlyDue.findMany({
      where: { memberRecordId: record.id },
      orderBy: [{ year: 'desc' }, { month: 'asc' }],
    });
    return { dues };
  });
};
