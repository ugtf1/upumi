import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../services/auth.js';
import { prisma } from '../services/prisma.js';

// Routes for normal users (scoped to themselves)
export const memberRoutes: FastifyPluginAsync = async (app) => {
  app.get('/my-dues', { preHandler: requireAuth }, async (req) => {
    const dues = await prisma.transaction.findMany({
      where: {
        userId: req.user.sub,
        title: { contains: 'Dues', mode: 'insensitive' },
      },
      orderBy: { date: 'desc' },
    });
    return { dues };
  });
};
