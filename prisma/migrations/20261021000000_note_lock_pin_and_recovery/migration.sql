-- AlterTable
ALTER TABLE "users" ADD COLUMN "noteLockPinHash" TEXT,
ADD COLUMN "pinRecoveryCode" TEXT,
ADD COLUMN "pinRecoveryExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lockPinHash" TEXT;
