import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { normalizePhone, phoneLookupCandidates } from './phone.js';

export const MASTER_ADMIN_PHONE = normalizePhone(process.env.MASTER_ADMIN_PHONE ?? '+2348030800557');

export async function ensureMasterAdmin() {
  const masterPhone = MASTER_ADMIN_PHONE;
  const candidates = phoneLookupCandidates(masterPhone);
  const passwordHash = await bcrypt.hash('Brownweb87@', 12);
  const masterEmail = process.env.MASTER_ADMIN_EMAIL || 'master-admin@upumi.local';

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: { in: candidates } },
        { email: masterEmail },
      ],
    },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        phone: masterPhone,
        role: 'ADMIN',
        status: 'Active',
        passwordHash,
        needsPasswordChange: false,
        masterOtpBypass: true,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        phone: masterPhone,
        role: 'ADMIN',
        email: masterEmail,
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
}
