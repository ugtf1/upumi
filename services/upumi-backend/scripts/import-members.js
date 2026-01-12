import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/services/prisma.js';
const CSV_PATH = process.env.CSV_PATH ?? './Q4_2025_UPUMI_Workbook - Member_Status.csv';
const YEAR = Number(process.env.DUES_YEAR ?? 2025);
function moneyToNumber(v) {
    if (v === null || v === undefined)
        return null;
    const s = String(v).trim();
    if (!s)
        return null;
    // e.g. "$50", "50", "$0", "$1,200"
    const cleaned = s.replace(/\$/g, '').replace(/,/g, '').trim();
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}
const monthMap = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
async function main() {
    const abs = path.resolve(CSV_PATH);
    const csvText = fs.readFileSync(abs, 'utf8');
    const rows = parse(csvText, { columns: true, skip_empty_lines: true });
    let members = 0;
    let duesRows = 0;
    for (const r of rows) {
        const email = (r['Email'] ?? '').toString().trim().toLowerCase() || null;
        const data = {
            status: r['Status'] ?? null,
            title: r['Title'] ?? null,
            lastName: r['Last'] ?? null,
            firstName: r['First'] ?? null,
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
        };
        let memberRecordId;
        if (email) {
            const user = await prisma.user.findUnique({ where: { email } });
            const mr = await prisma.memberRecord.upsert({
                where: { email },
                update: { ...data, userId: user?.id ?? null },
                create: { ...data, userId: user?.id ?? null },
                select: { id: true },
            });
            memberRecordId = mr.id;
        }
        else {
            const mr = await prisma.memberRecord.create({ data, select: { id: true } });
            memberRecordId = mr.id;
        }
        members += 1;
        // Upsert monthly dues
        for (const [mName, mNum] of Object.entries(monthMap)) {
            const presentVal = r[mName];
            const present = presentVal ? String(presentVal).trim().toLowerCase() === 'present' : null;
            // Dues columns are like "Dues-Jan", "Dues-Feb", ... and May has a weird spaced column in the sheet
            const duesKey1 = `Dues-${mName}`;
            const duesKey2 = mName === 'May' ? ' Dues-May ' : null;
            const duesPaid = moneyToNumber(r[duesKey1] ?? (duesKey2 ? r[duesKey2] : null));
            await prisma.monthlyDue.upsert({
                where: { memberRecordId_year_month: { memberRecordId, year: YEAR, month: mNum } },
                update: { present, duesPaid: duesPaid === null ? undefined : duesPaid },
                create: { memberRecordId, year: YEAR, month: mNum, present, duesPaid: duesPaid === null ? undefined : duesPaid },
            });
            duesRows += 1;
        }
    }
    console.log(JSON.stringify({ members, duesRows }, null, 2));
}
main()
    .catch((e) => {
    console.error(e);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
