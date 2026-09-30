-- Groups of companies with one owner, shared through one parent folder. The drive tables never had
-- a migration of their own (they were pushed), so each is created only where it is missing.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "drive";

-- CreateTable
CREATE TABLE IF NOT EXISTS "drive"."driveSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "clientState" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deltaLink" TEXT,
    "lastSweptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driveSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "drive"."driveMirror" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sourceDriveId" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "sourceEtag" TEXT,
    "sourcePath" TEXT NOT NULL,
    "targetDriveId" TEXT NOT NULL,
    "targetItemId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driveMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "drive"."clientDriveFolder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "webUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientDriveFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "drive"."clientDriveGuest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "permissionId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'read',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "clientDriveGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "drive"."clientDriveGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driveId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "webUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientDriveGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "drive"."clientDriveFolder" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- AlterTable
ALTER TABLE "drive"."clientDriveGuest" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "drive"."clientDriveGuest" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "driveSubscription_driveId_key" ON "drive"."driveSubscription"("driveId");
CREATE INDEX IF NOT EXISTS "driveSubscription_expiresAt_idx" ON "drive"."driveSubscription"("expiresAt");
CREATE INDEX IF NOT EXISTS "driveSubscription_organizationId_idx" ON "drive"."driveSubscription"("organizationId");
CREATE INDEX IF NOT EXISTS "driveMirror_organizationId_state_idx" ON "drive"."driveMirror"("organizationId", "state");
CREATE INDEX IF NOT EXISTS "driveMirror_clientId_idx" ON "drive"."driveMirror"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "driveMirror_sourceDriveId_sourceItemId_key" ON "drive"."driveMirror"("sourceDriveId", "sourceItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "clientDriveFolder_clientId_key" ON "drive"."clientDriveFolder"("clientId");
CREATE INDEX IF NOT EXISTS "clientDriveFolder_organizationId_idx" ON "drive"."clientDriveFolder"("organizationId");
CREATE INDEX IF NOT EXISTS "clientDriveFolder_groupId_idx" ON "drive"."clientDriveFolder"("groupId");
CREATE INDEX IF NOT EXISTS "clientDriveGroup_organizationId_archivedAt_idx" ON "drive"."clientDriveGroup"("organizationId", "archivedAt");
CREATE INDEX IF NOT EXISTS "clientDriveGuest_email_idx" ON "drive"."clientDriveGuest"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "clientDriveGuest_clientId_email_key" ON "drive"."clientDriveGuest"("clientId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "clientDriveGuest_groupId_email_key" ON "drive"."clientDriveGuest"("groupId", "email");
