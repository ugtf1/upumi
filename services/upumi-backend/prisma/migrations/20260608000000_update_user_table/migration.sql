-- AlterTable: Update User table to match current schema

-- Drop existing constraints that need to change
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
DROP INDEX IF EXISTS "User_email_key";

-- Make email optional 
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- Add new columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dateJoined" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "voteRole" TEXT NOT NULL DEFAULT 'No';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlyDues" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalPaid" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "outstanding" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpLastSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "masterOtpBypass" BOOLEAN NOT NULL DEFAULT false;

-- Update role default
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- Create partial unique index on phone (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone") WHERE "phone" IS NOT NULL;

-- Recreate email partial unique index (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;
