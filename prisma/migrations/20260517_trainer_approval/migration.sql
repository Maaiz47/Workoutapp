-- AlterTable: trainer upgrade requests now require admin approval
ALTER TABLE "User" ADD COLUMN "roleRequest" TEXT;
ALTER TABLE "User" ADD COLUMN "roleRequestNote" TEXT;
ALTER TABLE "User" ADD COLUMN "roleRequestAt" TIMESTAMP(3);
