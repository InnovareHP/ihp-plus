-- The weekly security-awareness email: AI-drafted issues, IT approval, and per-recipient deliveries.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "security";

-- CreateTable
CREATE TABLE "security"."securityDigestSettings" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeClients" BOOLEAN NOT NULL DEFAULT false,
    "reportTo" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "securityDigestSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "security"."securityDigestIssue" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "preheader" TEXT NOT NULL DEFAULT '',
    "intro" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "takeaway" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sendOn" DATE NOT NULL,
    "error" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "decidedById" TEXT,
    "decidedByName" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "securityDigestIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security"."securityDigestDelivery" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "securityDigestDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "securityDigestIssue_organizationId_createdAt_idx" ON "security"."securityDigestIssue"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "securityDigestIssue_status_sendOn_idx" ON "security"."securityDigestIssue"("status", "sendOn");

-- CreateIndex
CREATE INDEX "securityDigestDelivery_issueId_idx" ON "security"."securityDigestDelivery"("issueId");

-- AddForeignKey
ALTER TABLE "security"."securityDigestDelivery" ADD CONSTRAINT "securityDigestDelivery_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "security"."securityDigestIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

