-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "bluebook";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "org";

-- CreateTable
CREATE TABLE "bluebook"."bluebookDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bluebookDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org"."teamLead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teamLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bluebookDocument_organizationId_teamId_archivedAt_idx" ON "bluebook"."bluebookDocument"("organizationId", "teamId", "archivedAt");

-- CreateIndex
CREATE INDEX "bluebookDocument_organizationId_category_idx" ON "bluebook"."bluebookDocument"("organizationId", "category");

-- CreateIndex
CREATE INDEX "teamLead_organizationId_idx" ON "org"."teamLead"("organizationId");

-- CreateIndex
CREATE INDEX "teamLead_userId_idx" ON "org"."teamLead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "teamLead_teamId_userId_key" ON "org"."teamLead"("teamId", "userId");

