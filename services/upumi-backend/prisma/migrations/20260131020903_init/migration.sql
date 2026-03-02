-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT,
    "title" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "joined" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "whatsapp" TEXT,
    "facebook" TEXT,
    "goodStanding" TEXT,
    "financialGoodStanding" TEXT,
    "voter" TEXT,
    "insurance" TEXT,
    "attendancePct" TEXT,
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyDue" (
    "id" TEXT NOT NULL,
    "memberRecordId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "present" BOOLEAN,
    "duesPaid" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyDue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRecord_userId_key" ON "MemberRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRecord_email_key" ON "MemberRecord"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyDue_memberRecordId_year_month_key" ON "MonthlyDue"("memberRecordId", "year", "month");

-- AddForeignKey
ALTER TABLE "MemberRecord" ADD CONSTRAINT "MemberRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyDue" ADD CONSTRAINT "MonthlyDue_memberRecordId_fkey" FOREIGN KEY ("memberRecordId") REFERENCES "MemberRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
