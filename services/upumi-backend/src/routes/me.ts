import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../services/auth.js';
import { prisma } from '../services/prisma.js';

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, role: true, createdAt: true },
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
        phone: true,
        email: true,
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
};
