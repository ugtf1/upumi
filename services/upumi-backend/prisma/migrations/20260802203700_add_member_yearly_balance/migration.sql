-- CreateTable: global org-wide yearly balance (one row per year)
CREATE TABLE IF NOT EXISTS "yearlyBalances" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yearlyBalances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "yearlyBalances_year_key" ON "yearlyBalances"("year");

-- CreateTable: per-member yearly balance linked to MemberRecord
CREATE TABLE IF NOT EXISTS "memberYearlyBalances" (
    "id" TEXT NOT NULL,
    "member_record_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberYearlyBalances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "memberYearlyBalances_member_record_id_year_key" ON "memberYearlyBalances"("member_record_id", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "memberYearlyBalances_member_record_id_idx" ON "memberYearlyBalances"("member_record_id");

-- AddForeignKey (safe to re-run, skips if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memberYearlyBalances_member_record_id_fkey'
  ) THEN
    ALTER TABLE "memberYearlyBalances"
      ADD CONSTRAINT "memberYearlyBalances_member_record_id_fkey"
      FOREIGN KEY ("member_record_id") REFERENCES "MemberRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
