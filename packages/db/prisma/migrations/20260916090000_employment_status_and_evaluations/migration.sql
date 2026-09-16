-- Where each person stands in employment (probationary, regular, …) and the evaluations a
-- supervisor fills in about them.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "evaluations";

-- AlterTable
ALTER TABLE "auth"."user" ADD COLUMN "employmentStatus" TEXT;

-- AlterTable
ALTER TABLE "requests"."requestForm" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'request';

-- CreateTable
CREATE TABLE "evaluations"."evaluationAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "assignedById" TEXT,
    "formId" TEXT NOT NULL,
    "formName" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluationAssignment_organizationId_status_idx" ON "evaluations"."evaluationAssignment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "evaluationAssignment_evaluatorId_status_idx" ON "evaluations"."evaluationAssignment"("evaluatorId", "status");

-- CreateIndex
CREATE INDEX "evaluationAssignment_employeeId_status_idx" ON "evaluations"."evaluationAssignment"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "evaluations"."evaluationAssignment" ADD CONSTRAINT "evaluationAssignment_formId_fkey" FOREIGN KEY ("formId") REFERENCES "requests"."requestForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "requests"."requestForm_organizationId_status_idx";

-- CreateIndex
CREATE INDEX "requestForm_organizationId_kind_status_idx" ON "requests"."requestForm"("organizationId", "kind", "status");
