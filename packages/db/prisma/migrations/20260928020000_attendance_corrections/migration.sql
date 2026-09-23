-- Members ask for their own days to be corrected; an admin applies or turns each request down.

-- CreateTable
CREATE TABLE "attendance"."attendanceCorrection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "clockInTime" TEXT NOT NULL,
    "clockOutTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendanceCorrection_organizationId_status_idx" ON "attendance"."attendanceCorrection"("organizationId", "status");

-- CreateIndex
CREATE INDEX "attendanceCorrection_userId_workDate_idx" ON "attendance"."attendanceCorrection"("userId", "workDate");
