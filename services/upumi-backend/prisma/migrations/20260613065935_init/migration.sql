-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "email" TEXT,
    "fName" TEXT,
    "lName" TEXT,
    "dateJoined" TIMESTAMP(3),
    "voteRole" TEXT NOT NULL DEFAULT 'No',
    "address" TEXT,
    "monthlyDues" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "otpCodeHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpLastSentAt" TIMESTAMP(3),
    "masterOtpBypass" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generalFinance" (
    "id" TEXT NOT NULL,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "activeMembers" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pendingPayments" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "incomeYtd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expensesYtd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bussinessAccount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fundraiserAccount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAccBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "year" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generalFinance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "usersIn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hostingSchedule" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "hostMember" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hostingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dues" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberFinance" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monthlyDues" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberFinance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRecord" (
    "id" TEXT NOT NULL,
    "memberKey" TEXT NOT NULL,
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
    "rawJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkbookRow" (
    "id" TEXT NOT NULL,
    "sourceYear" INTEGER,
    "rowOrder" INTEGER NOT NULL,
    "rowType" TEXT,
    "title" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "hosting" TEXT,
    "rawJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbookRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyDue" (
    "id" TEXT NOT NULL,
    "memberRecordId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "present" BOOLEAN,
    "duesPaid" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyDue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_year_month_key" ON "attendance"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "hostingSchedule_year_month_key" ON "hostingSchedule"("year", "month");

-- CreateIndex
CREATE INDEX "dues_user_id_idx" ON "dues"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dues_user_id_year_month_key" ON "dues"("user_id", "year", "month");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "memberFinance_user_id_idx" ON "memberFinance"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRecord_memberKey_key" ON "MemberRecord"("memberKey");

-- CreateIndex
CREATE UNIQUE INDEX "MemberRecord_userId_key" ON "MemberRecord"("userId");

-- CreateIndex
CREATE INDEX "WorkbookRow_rowType_idx" ON "WorkbookRow"("rowType");

-- CreateIndex
CREATE INDEX "WorkbookRow_hosting_idx" ON "WorkbookRow"("hosting");

-- CreateIndex
CREATE INDEX "WorkbookRow_rowOrder_idx" ON "WorkbookRow"("rowOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyDue_memberRecordId_year_month_key" ON "MonthlyDue"("memberRecordId", "year", "month");

-- AddForeignKey
ALTER TABLE "dues" ADD CONSTRAINT "dues_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberFinance" ADD CONSTRAINT "memberFinance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRecord" ADD CONSTRAINT "MemberRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyDue" ADD CONSTRAINT "MonthlyDue_memberRecordId_fkey" FOREIGN KEY ("memberRecordId") REFERENCES "MemberRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
