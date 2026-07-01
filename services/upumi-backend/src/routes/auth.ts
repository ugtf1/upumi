import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { createHash, randomInt } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { normalizePhone, phoneLookupCandidates } from '../services/phone.js';
import { sendOtpSms } from '../services/twilio.js';

const PhoneSchema = z.object({
  phone: z.string().min(7).transform((s) => normalizePhone(s)),
});

const VerifyOtpSchema = PhoneSchema.extend({
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES ?? 10);

function otpHash(userId: string, otp: string) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  return createHash('sha256').update(`${userId}:${otp}:${secret}`).digest('hex');
}

function createOtp() {
  return String(randomInt(100000, 1000000));
}

async function findUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: { phone: { in: phoneLookupCandidates(phone) } },
  });
}

async function signLogin(reply: FastifyReply, user: { id: string; phone: string; email: string | null; role: string }) {
  const role = user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
  const token = await reply.jwtSign({ sub: user.id, phone: user.phone, email: user.email, role });
  return {
    token,
    redirectPath: role === 'ADMIN' ? '/admin' : '/member',
    user: { id: user.id, phone: user.phone, email: user.email, role },
  };
}

async function requestOtp(phone: string, reply: FastifyReply) {
  const user = await findUserByPhone(phone);
  if (!user) return reply.code(404).send({ message: 'record not found' });
  if (user.status !== 'Active') return reply.code(403).send({ message: 'Account is inactive' });

  if (user.masterOtpBypass) {
    const login = await signLogin(reply, user);
    return reply.send({ requiresOtp: false, ...login });
  }

  const otp = createOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otpCodeHash: otpHash(user.id, otp),
      otpExpiresAt: expiresAt,
      otpLastSentAt: new Date(),
    },
  });

  const twilioConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

  if (!twilioConfigured) {
    // Explicit, intentional opt-in only — do NOT gate this on NODE_ENV.
    // Cloud Run images/build pipelines often set NODE_ENV=production even
    // on services meant purely for dev/testing, so NODE_ENV isn't a
    // trustworthy signal for "safe to log OTPs." This flag must be set
    // deliberately on the specific service where you want the fallback,
    // and should never be set on anything customer-facing.
    if (process.env.ALLOW_OTP_LOG_FALLBACK !== 'true') {
      reply.log.error('Twilio is not configured and ALLOW_OTP_LOG_FALLBACK is not set; refusing to send OTP');
      return reply.code(500).send({ message: 'SMS delivery is not configured' });
    }
    reply.log.warn(`[DEV FALLBACK] Twilio not configured. OTP for ${user.phone}: ${otp}`);
    return reply.send({ requiresOtp: true, message: 'OTP sent (check server logs, Twilio not configured)' });
  }

  await sendOtpSms(user.phone, otp);
  return reply.send({ requiresOtp: true, message: 'OTP sent' });
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/request-otp', async (req, reply) => {
    const body = PhoneSchema.parse(req.body);
    return requestOtp(body.phone, reply);
  });

  app.post('/login', async (req, reply) => {
    const body = PhoneSchema.parse(req.body);
    return requestOtp(body.phone, reply);
  });

  app.post('/verify-otp', async (req, reply) => {
    const body = VerifyOtpSchema.parse(req.body);
    const user = await findUserByPhone(body.phone);
    if (!user) return reply.code(404).send({ message: 'record not found' });

    const isExpired = !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now();
    const expectedHash = user.otpCodeHash ?? '';
    if (isExpired || expectedHash !== otpHash(user.id, body.otp)) {
      return reply.code(401).send({ message: 'Invalid or expired OTP' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCodeHash: null,
        otpExpiresAt: null,
      },
    });

    const login = await signLogin(reply, user);
    return reply.send(login);
  });
};