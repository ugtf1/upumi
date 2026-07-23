import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from './services/prisma.js';
import { ensureMasterAdmin } from './services/masterAdmin.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { adminRoutes } from './routes/admin.js';
import { memberRoutes } from './routes/members.js';
import { adminDatabaseRoutes, memberDatabaseRoutes } from './routes/database.js';
import { meetingRoutes, memberMeetingRoutes } from './routes/meetings.js';

// ADD THESE (these files already exist in your backend)
import { analyticsRoutes } from './routes/analytics.js';
import { trafficRoutes } from './routes/traffic.js';

const PORT = Number(process.env.PORT ?? 8080);
const JWT_SECRET = process.env.JWT_SECRET ?? '';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? ''; // optional in BFF mode
const CORS_ORIGINS = CORS_ORIGIN
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Built React app gets copied here: services/upumi-backend/public
const WEB_PUBLIC_DIR = path.join(__dirname, '..', 'public');

async function main() {
  const app = Fastify({ logger: true });

  if (!JWT_SECRET) {
    app.log.warn('JWT_SECRET is empty. Set it in .env/Secret Manager for production.');
  }

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!CORS_ORIGINS.length) return cb(null, true);
      cb(null, CORS_ORIGINS.includes(origin));
    },
    credentials: true,
  });

  await app.register(jwt, {
    secret: JWT_SECRET || 'dev-secret',
  });

  // ---- Health endpoints ----
  app.get('/health', async () => ({ ok: true }));
  app.get('/api/health', async () => ({ ok: true }));

  // ---- API routes (MUST come before SPA/static fallback) ----
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(meRoutes, { prefix: '/api/me' });
  await app.register(memberRoutes, { prefix: '/api/members' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(adminDatabaseRoutes, { prefix: '/api/admin/database' });
  await app.register(memberDatabaseRoutes, { prefix: '/api/members/database' });
  await app.register(meetingRoutes, { prefix: '/api/admin' });
  await app.register(memberMeetingRoutes, { prefix: '/api/members' });

  //    Analytics endpoints expected by AnalyticsPage.tsx:
  //   GET /api/analytics/me?year=2026
  //   GET /api/analytics/summary?year=2026
  //   GET /api/analytics/traffic?period=30d
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });

  // IMPORTANT: trafficRoutes path depends on how traffic.ts is defined.
  // If traffic.ts defines app.get('/traffic', ...) then keep prefix '/api/analytics'
  // If traffic.ts defines app.get('/', ...) then change prefix to '/api/analytics/traffic'
  await app.register(trafficRoutes, { prefix: '/api/analytics' });

  // Gracefully attempt to ensure master admin exists; warn if DB is unavailable
try {
  await ensureMasterAdmin();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  app.log.warn(`Failed to initialize master admin (database may not be ready yet): ${message}`);
}

  // ---- Static hosting for web build ----
  await app.register(fastifyStatic, {
    root: WEB_PUBLIC_DIR,
    prefix: '/',
    decorateReply: true,
  });

  // ---- SPA fallback: never return HTML for /api/* ----
  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found' });
    }
    return reply.type('text/html').sendFile('index.html');
  });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);

    const e = err as {
      statusCode?: number;
      name?: string;
      message?: string;
    };

    const status = e.statusCode ?? 500;

    reply.status(status).send({
      error: e.name ?? 'Error',
      message: e.message ?? 'Unknown error',
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
  console.error(err);
  process.exit(1);
});
