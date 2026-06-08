-- AlterTable: Update User table to match current schema

-- Drop passwordHash if it exists
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";

-- Make email optional and drop its NOT NULL constraint
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Add new columns to User table
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "fName" TEXT;
ALTER TABLE "User" ADD COLUMN "lName" TEXT;
ALTER TABLE "User" ADD COLUMN "dateJoined" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "voteRole" TEXT NOT NULL DEFAULT 'No';
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "monthlyDues" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "outstanding" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "User" ADD COLUMN "otpCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "otpLastSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "masterOtpBypass" BOOLEAN NOT NULL DEFAULT false;

-- Update role default to match schema if not already set
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- Create unique index on phone
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Recreate email unique index (since we modified the column)
DROP INDEX IF EXISTS "User_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
