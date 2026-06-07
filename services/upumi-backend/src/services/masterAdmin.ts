import { prisma } from './prisma.js';
import { normalizePhone } from './phone.js';

export const MASTER_ADMIN_PHONE = normalizePhone(process.env.MASTER_ADMIN_PHONE ?? '08020909745');

export async function ensureMasterAdmin() {
  await prisma.user.upsert({
    where: { phone: MASTER_ADMIN_PHONE },
    update: {
      role: 'ADMIN',
      status: 'Active',
      masterOtpBypass: true,
    },
    create: {
      phone: MASTER_ADMIN_PHONE,
      role: 'ADMIN',
      email: process.env.MASTER_ADMIN_EMAIL || 'master-admin@upumi.local',
      fName: 'Master',
      lName: 'Admin',
      dateJoined: new Date(),
      voteRole: 'Yes',
      status: 'Active',
      masterOtpBypass: true,
    },
  });
}
