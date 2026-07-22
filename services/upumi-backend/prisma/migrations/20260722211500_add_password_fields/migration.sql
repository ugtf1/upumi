-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "needsPasswordChange" BOOLEAN NOT NULL DEFAULT true;
