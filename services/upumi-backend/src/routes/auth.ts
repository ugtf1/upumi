import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma.js';

const RegisterSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(10),
});

const LoginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return reply.status(409).send({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash },
      select: { id: true, email: true, role: true },
    });

    // If there is already a workbook row with this email, auto-link it.
    await prisma.memberRecord.updateMany({
      where: { email: body.email, userId: null },
      data: { userId: user.id },
    });

    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
    return reply.send({ token, user });
  });

  app.post('/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return reply.status(401).send({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return reply.status(401).send({ message: 'Invalid credentials' });

    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
    return reply.send({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  // One-time admin creation endpoint.
  // Protect it with an env secret and delete/disable after initial setup.
  app.post('/bootstrap-admin', async (req, reply) => {
    const secret = (req.headers['x-admin-bootstrap'] ?? '').toString();
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET ?? '';
    if (!expected || secret !== expected) {
      return reply.status(403).send({ message: 'Forbidden' });
    }

    const body = RegisterSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) return reply.status(409).send({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, role: 'ADMIN' },
      select: { id: true, email: true, role: true },
    });

    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
    return reply.send({ token, user });
  });
};
