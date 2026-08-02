-- CreateTable
CREATE TABLE "memberYearlyBalances" (
    "id" TEXT NOT NULL,
    "member_record_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberYearlyBalances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memberYearlyBalances_member_record_id_year_key" ON "memberYearlyBalances"("member_record_id", "year");

-- CreateIndex
CREATE INDEX "memberYearlyBalances_member_record_id_idx" ON "memberYearlyBalances"("member_record_id");

-- AddForeignKey
ALTER TABLE "memberYearlyBalances" ADD CONSTRAINT "memberYearlyBalances_member_record_id_fkey" FOREIGN KEY ("member_record_id") REFERENCES "MemberRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
