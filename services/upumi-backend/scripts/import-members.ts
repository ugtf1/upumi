import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/services/prisma.js';
import { importWorkbookCsv } from '../src/services/workbookImport.js';

const CSV_PATH = process.env.CSV_PATH ?? './Member_Status.csv';
const YEAR = Number(process.env.DUES_YEAR ?? 2026);

async function main() {
  const abs = path.resolve(CSV_PATH);
  const csvText = fs.readFileSync(abs, 'utf8');
  const result = await importWorkbookCsv(csvText, YEAR);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

