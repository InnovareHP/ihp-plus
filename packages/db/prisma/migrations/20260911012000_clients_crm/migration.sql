-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "clients";

-- CreateTable
CREATE TABLE "clients"."client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_organizationId_archivedAt_idx" ON "clients"."client"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "client_organizationId_status_idx" ON "clients"."client"("organizationId", "status");

-- CreateIndex
CREATE INDEX "client_organizationId_ownerId_idx" ON "clients"."client"("organizationId", "ownerId");

