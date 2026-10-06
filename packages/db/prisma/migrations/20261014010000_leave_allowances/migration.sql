-- Yearly leave allowances: one number per time off form, and per-person overrides of it.

-- AlterTable
ALTER TABLE "requests"."requestForm" ADD COLUMN "leaveAllowance" INTEGER;

-- CreateTable
CREATE TABLE "requests"."leaveAllowance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaveAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaveAllowance_formId_userId_key" ON "requests"."leaveAllowance"("formId", "userId");

-- CreateIndex
CREATE INDEX "leaveAllowance_organizationId_userId_idx" ON "requests"."leaveAllowance"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "requests"."leaveAllowance" ADD CONSTRAINT "leaveAllowance_formId_fkey" FOREIGN KEY ("formId") REFERENCES "requests"."requestForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
