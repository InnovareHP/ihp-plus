-- The client link and the record of a client accepting a contract through it.

-- AlterTable
ALTER TABLE "contracts"."contract" ADD COLUMN "sharedAt" TIMESTAMP(3),
ADD COLUMN "viewedAt" TIMESTAMP(3),
ADD COLUMN "acceptedByName" TEXT,
ADD COLUMN "acceptedIp" TEXT,
ADD COLUMN "acceptedUserAgent" TEXT;
