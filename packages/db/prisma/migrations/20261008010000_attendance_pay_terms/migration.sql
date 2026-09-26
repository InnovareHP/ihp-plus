-- How each contractor is paid, and which basis a printed statement was billed on.

-- AlterTable
ALTER TABLE "attendance"."attendanceStatement" ADD COLUMN "fixedPay" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "attendance"."attendancePayTerms" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fixedPay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendancePayTerms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendancePayTerms_organizationId_userId_key" ON "attendance"."attendancePayTerms"("organizationId", "userId");
