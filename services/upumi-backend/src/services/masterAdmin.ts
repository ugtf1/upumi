import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { normalizePhone } from './phone.js';

export const MASTER_ADMIN_PHONE = normalizePhone(process.env.MASTER_ADMIN_PHONE ?? '+2348030800557');

export async function ensureMasterAdmin() {
  const masterPhone = MASTER_ADMIN_PHONE;
  const passwordHash = await bcrypt.hash('Brownweb87@', 12);

  await prisma.user.upsert({
    where: { phone: masterPhone },
    update: {
      role: 'ADMIN',
      status: 'Active',
      passwordHash,
      needsPasswordChange: false,
      masterOtpBypass: true,
    },
    create: {
      phone: masterPhone,
      role: 'ADMIN',
      email: process.env.MASTER_ADMIN_EMAIL || 'master-admin@upumi.local',
      fName: 'Master',
      lName: 'Admin',
      dateJoined: new Date(),
      voteRole: 'Yes',
      status: 'Active',
      passwordHash,
      needsPasswordChange: false,
      masterOtpBypass: true,
    },
  });
}
