import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { normalizePhone, phoneLookupCandidates } from '../services/phone.js';

const PhoneSchema = z.object({
  phone: z.string().min(7).transform((s) => normalizePhone(s)),
});

const LoginSchema = PhoneSchema.extend({
  password: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

async function findUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: { phone: { in: phoneLookupCandidates(phone) } },
  });
}

async function signLogin(reply: FastifyReply, user: { id: string; phone: string; email: string | null; role: string; needsPasswordChange: boolean }) {
  const role = user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
  const token = await reply.jwtSign({
    sub: user.id,
    phone: user.phone,
    email: user.email,
    role,
    needsPasswordChange: user.needsPasswordChange,
  });
  return {
    token,
    redirectPath: role === 'ADMIN' ? '/admin' : '/member',
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role,
      needsPasswordChange: user.needsPasswordChange,
    },
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const user = await findUserByPhone(body.phone);

    if (!user) {
      return reply.code(401).send({ message: 'Invalid phone number or password' });
    }

    if (user.status !== 'Active') {
      return reply.code(403).send({ message: 'Account is inactive' });
    }

    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(body.password, user.passwordHash);
    } else {
      const lastNameTemp = (user.lName || '').trim().toUpperCase();
      if (!lastNameTemp) {
        return reply.code(401).send({ message: 'No password set for this account. Please contact support.' });
      }
      isMatch = body.password === lastNameTemp;
    }

    if (!isMatch) {
      return reply.code(401).send({ message: 'Invalid phone number or password' });
    }

    const login = await signLogin(reply, {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      needsPasswordChange: user.needsPasswordChange,
    });
    return reply.send(login);
  });

  // POST /api/auth/change-password
  app.post('/change-password', async (req, reply) => {
    await req.jwtVerify();
    const userId = req.user.sub;
    const body = ChangePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.code(404).send({ message: 'User not found' });
    }

    // Verify current password
    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(body.currentPassword, user.passwordHash);
    } else {
      const lastNameTemp = (user.lName || '').trim().toUpperCase();
      isMatch = lastNameTemp ? body.currentPassword === lastNameTemp : false;
    }

    if (!isMatch) {
      return reply.code(400).send({ message: 'Incorrect current password' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(body.newPassword, 12);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        needsPasswordChange: false,
      },
    });

    const login = await signLogin(reply, {
      id: updatedUser.id,
      phone: updatedUser.phone,
      email: updatedUser.email,
      role: updatedUser.role,
      needsPasswordChange: updatedUser.needsPasswordChange,
    });

    return reply.send({
      ...login,
      message: 'Password changed successfully',
    });
  });
};