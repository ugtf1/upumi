import { parse } from 'csv-parse/sync';
import { prisma } from './prisma.js';

const monthMap: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function moneyToNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/\$/g, '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeKeyPart(v: unknown) {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function buildMemberKey(firstName: unknown, lastName: unknown) {
  const fn = normalizeKeyPart(firstName);
  const ln = normalizeKeyPart(lastName);
  if (!fn && !ln) return null;
  return `${ln}.${fn}`.replace(/\.+/g, '.');
}

export function toSheetCsvExportUrl(input: string, gid = '0') {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/export?format=csv')) return trimmed;

  const idMatch = trimmed.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!idMatch) return trimmed;
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

export async function importWorkbookCsv(csvText: string, year: number) {
  const rows: any[] = parse(csvText, { columns: true, skip_empty_lines: true });
  const prismaAny = prisma as any;

  await prismaAny.workbookRow.deleteMany();
  if (rows.length) {
    await prismaAny.workbookRow.createMany({
      data: rows.map((r, idx) => {
        const email = (r['Email'] ?? '').toString().trim().toLowerCase() || null;
        const rowType = (r['Status'] ?? '').toString().trim() || null;
        return {
          sourceYear: year,
          rowOrder: idx + 1,
          rowType,
          title: (r['Title'] ?? '').toString().trim() || null,
          firstName: (r['First'] ?? '').toString().trim() || null,
          lastName: (r['Last'] ?? '').toString().trim() || null,
          email,
          hosting: (r['Hosting'] ?? '').toString().trim() || null,
          rawJson: r,
        };
      }),
    });
  }

  let importedMembers = 0;
  let skippedMembers = 0;
  let duesRows = 0;

  for (const r of rows) {
    const rowType = (r['Status'] ?? '').toString().trim().toLowerCase();
    if (rowType !== 'member') continue;

    const email = (r['Email'] ?? '').toString().trim().toLowerCase() || null;
    const firstName = r['First'] ?? null;
    const lastName = r['Last'] ?? null;
    const memberKey = buildMemberKey(firstName, lastName);
    if (!memberKey || memberKey === '.' || memberKey === 'null.null') {
      skippedMembers += 1;
      continue;
    }

    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    const mr = await prisma.memberRecord.upsert({
      where: { memberKey },
      update: {
        status: r['Status'] ?? null,
        title: r['Title'] ?? null,
        lastName,
        firstName,
        joined: r['Joined'] ?? null,
        phone: r['Phone2'] ?? null,
        email,
        whatsapp: r['Whatsapp'] ?? null,
        facebook: r['facebook'] ?? null,
        goodStanding: r['GoodStanding'] ?? null,
        financialGoodStanding: r['Financial GoodStanding'] ?? null,
        voter: r['Voter'] ?? null,
        insurance: r['Insurance?'] ?? null,
        attendancePct: r['%Attendance'] ?? null,
        rawJson: r,
        userId: user?.id ?? null,
      },
      create: {
        memberKey,
        status: r['Status'] ?? null,
        title: r['Title'] ?? null,
        lastName,
        firstName,
        joined: r['Joined'] ?? null,
        phone: r['Phone2'] ?? null,
        email,
        whatsapp: r['Whatsapp'] ?? null,
        facebook: r['facebook'] ?? null,
        goodStanding: r['GoodStanding'] ?? null,
        financialGoodStanding: r['Financial GoodStanding'] ?? null,
        voter: r['Voter'] ?? null,
        insurance: r['Insurance?'] ?? null,
        attendancePct: r['%Attendance'] ?? null,
        rawJson: r,
        userId: user?.id ?? null,
      },
      select: { id: true },
    });

    importedMembers += 1;

    for (const [mName, mNum] of Object.entries(monthMap)) {
      const presentVal = r[mName];
      const present = presentVal ? String(presentVal).trim().toLowerCase() === 'present' : null;

      const duesKey1 = `Dues-${mName}`;
      const duesKey2 = mName === 'May' ? ' Dues-May ' : null;
      const duesPaid = moneyToNumber(r[duesKey1] ?? (duesKey2 ? r[duesKey2] : null));

      await prisma.monthlyDue.upsert({
        where: { memberRecordId_year_month: { memberRecordId: mr.id, year, month: mNum } },
        update: { present, duesPaid },
        create: { memberRecordId: mr.id, year, month: mNum, present, duesPaid },
      });
      duesRows += 1;
    }
  }

  return {
    workbookRows: rows.length,
    importedMembers,
    skippedMembers,
    duesRows,
  };
}

