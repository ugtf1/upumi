/*
  Warnings:

  - A unique constraint covering the columns `[memberKey]` on the table `MemberRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `memberKey` to the `MemberRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MemberRecord_email_key";

-- AlterTable
ALTER TABLE "MemberRecord" ADD COLUMN     "memberKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MonthlyDue" ALTER COLUMN "duesPaid" SET DATA TYPE DECIMAL(65,30);

-- CreateIndex
CREATE UNIQUE INDEX "MemberRecord_memberKey_key" ON "MemberRecord"("memberKey");
