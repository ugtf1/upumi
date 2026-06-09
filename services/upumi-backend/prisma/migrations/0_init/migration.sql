-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "email" TEXT,
    "fName" TEXT,
    "lName" TEXT,
    "dateJoined" DATETIME,
    "voteRole" TEXT NOT NULL DEFAULT 'No',
    "address" TEXT,
    "monthlyDues" DECIMAL NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL NOT NULL DEFAULT 0,
    "outstanding" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "otpCodeHash" TEXT,
    "otpExpiresAt" DATETIME,
    "otpLastSentAt" DATETIME,
    "masterOtpBypass" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GeneralFinance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "activeMembers" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL NOT NULL DEFAULT 0,
    "pendingPayments" DECIMAL NOT NULL DEFAULT 0,
    "incomeYtd" DECIMAL NOT NULL DEFAULT 0,
    "expensesYtd" DECIMAL NOT NULL DEFAULT 0,
    "bussinessAccount" DECIMAL NOT NULL DEFAULT 0,
    "fundraiserAccount" DECIMAL NOT NULL DEFAULT 0,
    "totalAccBalance" DECIMAL NOT NULL DEFAULT 0,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "usersIn" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HostingSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "hostMember" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Due" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Due_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "amountPaid" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MemberFinance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "monthlyDues" DECIMAL NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL NOT NULL DEFAULT 0,
    "outstanding" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberFinance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MemberRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "memberKey" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MemberRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkbookRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceYear" INTEGER,
    "rowOrder" INTEGER NOT NULL,
    "rowType" TEXT,
    "title" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "hosting" TEXT,
    "rawJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Attendance_year_month_key" ON "Attendance"("year", "month");
CREATE UNIQUE INDEX "HostingSchedule_year_month_key" ON "HostingSchedule"("year", "month");
CREATE UNIQUE INDEX "Due_userId_year_month_key" ON "Due"("userId", "year", "month");
CREATE INDEX "Due_userId_idx" ON "Due"("userId");
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "MemberFinance_userId_idx" ON "MemberFinance"("userId");
CREATE UNIQUE INDEX "MemberRecord_userId_key" ON "MemberRecord"("userId");
CREATE UNIQUE INDEX "MemberRecord_memberKey_key" ON "MemberRecord"("memberKey");
CREATE INDEX "WorkbookRow_rowType_idx" ON "WorkbookRow"("rowType");
CREATE INDEX "WorkbookRow_hosting_idx" ON "WorkbookRow"("hosting");
CREATE INDEX "WorkbookRow_rowOrder_idx" ON "WorkbookRow"("rowOrder");
