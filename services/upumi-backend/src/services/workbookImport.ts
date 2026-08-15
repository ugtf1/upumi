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

export function toSheetCsvExportUrl(input: string, opts?: { gid?: string; sheetTab?: string }) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return '';
  const gid = String(opts?.gid ?? '').trim();
  const sheetTab = String(opts?.sheetTab ?? '').trim();

  if (trimmed.includes('/export?format=csv')) {
    if (gid) return `${trimmed}${trimmed.includes('?') ? '&' : '?'}gid=${encodeURIComponent(gid)}`;
    if (sheetTab) return `${trimmed}${trimmed.includes('?') ? '&' : '?'}sheet=${encodeURIComponent(sheetTab)}`;
    return trimmed;
  }

  const idMatch = trimmed.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!idMatch) return trimmed;
  if (gid) {
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  }
  if (sheetTab) {
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&sheet=${encodeURIComponent(sheetTab)}`;
  }
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv`;
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
          rawJson: typeof r === 'string' ? r : JSON.stringify(r),
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

    const currentMonth = new Date().getMonth() + 1;
    let duesPaidYear = 0;
    for (const mName of Object.keys(monthMap)) {
      const k1 = `Dues-${mName}`;
      const k2 = mName === 'May' ? ' Dues-May ' : null;
      const val = moneyToNumber(r[k1] ?? (k2 ? r[k2] : null));
      if (val !== null) duesPaidYear += val;
    }
    if (r['2026 dues paid'] != null && moneyToNumber(r['2026 dues paid']) !== null) {
      duesPaidYear = moneyToNumber(r['2026 dues paid'])!;
    }

    const balance2026 = duesPaidYear - (20 * Math.max(1, Math.min(12, currentMonth)));

    const pastYears = ['2025 balance', '2024 balance', '2023 balance', '2022 balance', '2021 balance2', '2020 balance', '2019 balance', '2018 balance'];
    let pastBalanceSum = 0;
    for (const k of pastYears) {
      const b = moneyToNumber(r[k]);
      if (b !== null) pastBalanceSum += b;
    }

    const totalBalance = balance2026 + pastBalanceSum;
    const calculatedFinancialGoodStanding = totalBalance >= -240 ? 'Yes' : 'No';

    let presentCount = 0;
    for (const mName of Object.keys(monthMap)) {
      const val = r[mName];
      if (val && String(val).trim().toLowerCase() === 'present') {
        presentCount += 1;
      }
    }
    const attendanceRatio = currentMonth > 0 ? presentCount / currentMonth : 0;
    const calculatedAttendancePct = r['%Attendance'] ? String(r['%Attendance']).trim() : `${Math.round(attendanceRatio * 100)}%`;

    const levies = moneyToNumber(r['Levies']) ?? 0;
    const calculatedGoodStanding = (totalBalance >= -240 && levies === 0 && attendanceRatio >= 0.58) ? 'Yes' : 'No';
    const calculatedVoter = (calculatedFinancialGoodStanding === 'Yes' && calculatedGoodStanding === 'Yes') ? 'Yes' : 'No';

    const premiumPaid = moneyToNumber(r['Ins. premium paid']) ?? 0;
    const joinedStr = r['Joined'] ? String(r['Joined']).trim() : null;
    let yearsActive = 2;
    if (joinedStr) {
      const jDate = new Date(joinedStr);
      if (!isNaN(jDate.getTime())) {
        yearsActive = (new Date().getTime() - jDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      }
    }
    const calculatedInsurance = (premiumPaid >= 149 || (calculatedFinancialGoodStanding === 'Yes' && yearsActive >= 2)) ? 'Yes' : 'No';

    const goodStandingVal = r['GoodStanding'] ? String(r['GoodStanding']).trim() : calculatedGoodStanding;
    const financialGoodStandingVal = r['Financial GoodStanding'] ? String(r['Financial GoodStanding']).trim() : calculatedFinancialGoodStanding;
    const voterVal = r['Voter'] ? String(r['Voter']).trim() : calculatedVoter;
    const insuranceVal = r['Insurance?'] ? String(r['Insurance?']).trim() : calculatedInsurance;

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
        goodStanding: goodStandingVal,
        financialGoodStanding: financialGoodStandingVal,
        voter: voterVal,
        insurance: insuranceVal,
        attendancePct: calculatedAttendancePct,
        rawJson: typeof r === 'string' ? r : JSON.stringify(r),
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
        goodStanding: goodStandingVal,
        financialGoodStanding: financialGoodStandingVal,
        voter: voterVal,
        insurance: insuranceVal,
        attendancePct: calculatedAttendancePct,
        rawJson: typeof r === 'string' ? r : JSON.stringify(r),
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

