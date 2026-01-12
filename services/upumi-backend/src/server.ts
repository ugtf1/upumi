import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

import { prisma } from './services/prisma.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { adminRoutes } from './routes/admin.js';
import { memberRoutes } from './routes/members.js';

const PORT = Number(process.env.PORT ?? 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET ?? '';

async function main() {
  const app = Fastify({ logger: true });

  if (!JWT_SECRET) {
    app.log.warn('JWT_SECRET is empty. Set it in .env for production.');
  }

  await app.register(cors, {
    origin: (origin, cb) => {
      // allow server-to-server + local tools with no origin
      if (!origin) return cb(null, true);
      cb(null, origin === CORS_ORIGIN);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await app.register(jwt, {
    secret: JWT_SECRET || 'dev-secret',
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(meRoutes, { prefix: '/me' });
  await app.register(memberRoutes, { prefix: '/members' });
  await app.register(adminRoutes, { prefix: '/admin' });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const status = err.statusCode ?? 500;
    reply.status(status).send({
      error: err.name,
      message: err.message,
    });
  });

  const closeWithGrace = async () => {
    try {
      await app.close();
    } finally {
      await prisma.$disconnect();
    }
  };

  process.on('SIGTERM', closeWithGrace);
  process.on('SIGINT', closeWithGrace);

  await app.listen({ port: PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});