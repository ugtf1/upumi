#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";

function usage() {
  console.log(`
Usage:
  node scripts/import-members.js /path/to/member_status.csv
`);
}

function safeStr(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

function normalizeKeyPart(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildMemberKey(firstName, lastName) {
  const fn = normalizeKeyPart(firstName);
  const ln = normalizeKeyPart(lastName);
  if (!fn && !ln) return null;
  return `${ln}.${fn}`.replace(/\.+/g, ".");
}

function toMoneyDecimal(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  const cleaned = s.replace(/\$/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n.toFixed(2));
}

// Small CSV parser (supports quoted fields)
function parseCsv(text) {
  const rows = [];
  let i = 0,
    field = "",
    row = [],
    inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
      i++;
      continue;
    }

    field += c;
    i++;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = (rows.shift() ?? []).map((h) => String(h).trim());

  const data = rows
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""))
    .map((r) => {
      const obj = {};
      for (let idx = 0; idx < header.length; idx++) {
        obj[header[idx]] = r[idx] ?? "";
      }
      return obj;
    });

  return data;
}

// Detect month columns like "Jan 2026", "Feb", etc.
const MONTHS = [
  { m: 1, names: ["jan", "january"] },
  { m: 2, names: ["feb", "february"] },
  { m: 3, names: ["mar", "march"] },
  { m: 4, names: ["apr", "april"] },
  { m: 5, names: ["may"] },
  { m: 6, names: ["jun", "june"] },
  { m: 7, names: ["jul", "july"] },
  { m: 8, names: ["aug", "august"] },
  { m: 9, names: ["sep", "sept", "september"] },
  { m: 10, names: ["oct", "october"] },
  { m: 11, names: ["nov", "november"] },
  { m: 12, names: ["dec", "december"] },
];

function detectMonthCols(headers) {
  const cols = [];
  for (const h of headers) {
    const key = String(h).trim();
    const lower = key.toLowerCase();

    const monthObj = MONTHS.find((mm) => mm.names.some((n) => lower.includes(n)));
    if (!monthObj) continue;

    const yearMatch = lower.match(/(19|20)\d{2}/);
    const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();

    cols.push({ header: key, year, month: monthObj.m });
  }
  return cols;
}

// ✅ NEW: normalize row keys so "First"/"LAST"/etc become row.first / row.last
function normalizeRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[String(k).trim().toLowerCase()] = v;
  }
  return out;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    usage();
    process.exit(1);
  }

  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`CSV not found: ${abs}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Add it to .env");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const started = Date.now();

  try {
    const raw = fs.readFileSync(abs, "utf8");
    const rows = parseCsv(raw);
    if (!rows.length) {
      console.log("No rows found in CSV.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const monthCols = detectMonthCols(headers);

    console.log(`Rows: ${rows.length}`);
    console.log(`Detected month columns: ${monthCols.length}`);

    let upsertedMembers = 0;
    let upsertedDues = 0;
    let skippedNoKey = 0;

    for (const r0 of rows) {
      const r = normalizeRowKeys(r0);

      // ✅ Your CSV headers: Last, First
      const firstName = safeStr(r.first);
      const lastName = safeStr(r.last);

      const memberKey = buildMemberKey(firstName, lastName);
      if (!memberKey || memberKey === "." || memberKey === "null.null") {
        skippedNoKey++;
        continue;
      }

      const emailRaw = safeStr(r.email);
      const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;

      const status = safeStr(r.status);

      const member = await prisma.memberRecord.upsert({
        where: { memberKey },
        update: {
          firstName,
          lastName,
          email,
          status,
          rawJson: r0, // keep original shape in rawJson
        },
        create: {
          memberKey,
          firstName,
          lastName,
          email,
          status,
          rawJson: r0,
        },
        select: { id: true },
      });
      upsertedMembers++;

      // Monthly dues (these headers are case-sensitive in r0, so use r0)
      for (const col of monthCols) {
        const val = r0[col.header];
        const cleaned = String(val ?? "").trim();
        if (!cleaned) continue;

        const lower = cleaned.toLowerCase();
        const present =
          lower === "p" || lower === "present" || lower === "y" || lower === "yes"
            ? true
            : lower === "n" || lower === "no"
            ? false
            : null;

        const duesPaid = toMoneyDecimal(cleaned);

        await prisma.monthlyDue.upsert({
          where: {
            memberRecordId_year_month: {
              memberRecordId: member.id,
              year: col.year,
              month: col.month,
            },
          },
          update: { present, duesPaid },
          create: {
            memberRecordId: member.id,
            year: col.year,
            month: col.month,
            present,
            duesPaid,
          },
        });
        upsertedDues++;
      }
    }

    const ms = Date.now() - started;
    console.log(`✅ Done in ${Math.round(ms / 1000)}s`);
    console.log(`Members upserted: ${upsertedMembers}`);
    console.log(`Members skipped (no name-derived key): ${skippedNoKey}`);
    console.log(`Dues upserted:    ${upsertedDues}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});