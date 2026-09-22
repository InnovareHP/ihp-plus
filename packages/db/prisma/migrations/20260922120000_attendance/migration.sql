-- The daily clock: one row per person per working day, the breaks inside it, the shift rules an
-- admin sets, and the per-person shift that overrides them.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "attendance";

-- CreateTable
CREATE TABLE "attendance"."attendanceSettings" (
    "organizationId" TEXT NOT NULL,
    "requireSelfie" BOOLEAN NOT NULL DEFAULT false,
    "allowManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "requireNote" BOOLEAN NOT NULL DEFAULT false,
    "captureLocation" BOOLEAN NOT NULL DEFAULT false,
    "autoClockOutHours" INTEGER NOT NULL DEFAULT 16,
    "shiftStartMinutes" INTEGER NOT NULL DEFAULT 540,
    "shiftEndMinutes" INTEGER NOT NULL DEFAULT 1080,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "workdays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "attendance"."attendanceSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftStartMinutes" INTEGER NOT NULL,
    "shiftEndMinutes" INTEGER NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "workdays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendanceSchedule_organizationId_userId_key" ON "attendance"."attendanceSchedule"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "attendanceSchedule_organizationId_idx" ON "attendance"."attendanceSchedule"("organizationId");

-- CreateTable
CREATE TABLE "attendance"."attendanceDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "clockInAt" TIMESTAMP(3) NOT NULL,
    "clockOutAt" TIMESTAMP(3),
    "workedSeconds" INTEGER NOT NULL DEFAULT 0,
    "breakSeconds" INTEGER NOT NULL DEFAULT 0,
    "lateSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'clock',
    "note" TEXT,
    "clockInSelfieKey" TEXT,
    "clockOutSelfieKey" TEXT,
    "clockInLocation" TEXT,
    "clockOutLocation" TEXT,
    "editedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendanceDay_userId_workDate_key" ON "attendance"."attendanceDay"("userId", "workDate");

-- CreateIndex
CREATE INDEX "attendanceDay_organizationId_workDate_idx" ON "attendance"."attendanceDay"("organizationId", "workDate");

-- CreateIndex
CREATE INDEX "attendanceDay_userId_clockOutAt_idx" ON "attendance"."attendanceDay"("userId", "clockOutAt");

-- CreateTable
CREATE TABLE "attendance"."attendanceBreak" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendanceBreak_dayId_startedAt_idx" ON "attendance"."attendanceBreak"("dayId", "startedAt");

-- AddForeignKey
ALTER TABLE "attendance"."attendanceBreak" ADD CONSTRAINT "attendanceBreak_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "attendance"."attendanceDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
