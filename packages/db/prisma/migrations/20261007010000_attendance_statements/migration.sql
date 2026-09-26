-- Contractors' billing statements, kept so they can be printed again and found by payroll.

-- CreateTable
CREATE TABLE "attendance"."attendanceStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "contractorName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "daysWorked" INTEGER NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "dailyRateCents" INTEGER NOT NULL,
    "bonusCents" INTEGER NOT NULL,
    "expenses" JSONB NOT NULL,
    "wiseLink" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendanceStatement_organizationId_createdAt_idx" ON "attendance"."attendanceStatement"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "attendanceStatement_userId_invoiceNumber_key" ON "attendance"."attendanceStatement"("userId", "invoiceNumber");

