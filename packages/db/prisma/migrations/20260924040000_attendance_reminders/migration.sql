-- Reminder emails: a per-shift switch, and a log so each reminder is sent once.

-- AlterTable
ALTER TABLE "attendance"."attendanceShift" ADD COLUMN     "sendReminders" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "attendance"."attendanceReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendanceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendanceReminder_organizationId_workDate_idx" ON "attendance"."attendanceReminder"("organizationId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "attendanceReminder_userId_workDate_kind_key" ON "attendance"."attendanceReminder"("userId", "workDate", "kind");
