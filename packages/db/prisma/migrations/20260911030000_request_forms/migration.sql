-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "requests";

-- CreateTable
CREATE TABLE "requests"."requestForm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requestForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests"."requestFormTeam" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "requestFormTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests"."requestApprover" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requestApprover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests"."requestSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "teamId" TEXT,
    "teamName" TEXT,
    "formName" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "values" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requestForm_organizationId_status_idx" ON "requests"."requestForm"("organizationId", "status");

-- CreateIndex
CREATE INDEX "requestFormTeam_teamId_idx" ON "requests"."requestFormTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "requestFormTeam_formId_teamId_key" ON "requests"."requestFormTeam"("formId", "teamId");

-- CreateIndex
CREATE INDEX "requestApprover_organizationId_idx" ON "requests"."requestApprover"("organizationId");

-- CreateIndex
CREATE INDEX "requestApprover_userId_idx" ON "requests"."requestApprover"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "requestApprover_teamId_userId_key" ON "requests"."requestApprover"("teamId", "userId");

-- CreateIndex
CREATE INDEX "requestSubmission_organizationId_status_idx" ON "requests"."requestSubmission"("organizationId", "status");

-- CreateIndex
CREATE INDEX "requestSubmission_requesterId_status_idx" ON "requests"."requestSubmission"("requesterId", "status");

-- CreateIndex
CREATE INDEX "requestSubmission_teamId_status_idx" ON "requests"."requestSubmission"("teamId", "status");

-- AddForeignKey
ALTER TABLE "requests"."requestFormTeam" ADD CONSTRAINT "requestFormTeam_formId_fkey" FOREIGN KEY ("formId") REFERENCES "requests"."requestForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests"."requestSubmission" ADD CONSTRAINT "requestSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "requests"."requestForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
