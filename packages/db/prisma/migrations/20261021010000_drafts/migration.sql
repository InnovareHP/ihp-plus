-- Contracts and proposals admins draft by chatting with the AI.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "drafts";

-- CreateTable
CREATE TABLE "drafts"."draft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "previousBody" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "draft_organizationId_updatedAt_idx" ON "drafts"."draft"("organizationId", "updatedAt");
