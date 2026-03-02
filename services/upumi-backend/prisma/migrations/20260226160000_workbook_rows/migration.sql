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
    "rawJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkbookRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkbookRow_rowType_idx" ON "WorkbookRow"("rowType");

-- CreateIndex
CREATE INDEX "WorkbookRow_hosting_idx" ON "WorkbookRow"("hosting");

-- CreateIndex
CREATE INDEX "WorkbookRow_rowOrder_idx" ON "WorkbookRow"("rowOrder");
