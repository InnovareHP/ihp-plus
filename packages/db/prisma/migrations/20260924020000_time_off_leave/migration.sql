-- Time off: a request form can be marked as one, and approving it books its dates as leave.

-- AlterTable
ALTER TABLE "requests"."requestForm" ADD COLUMN     "timeOff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "attendance"."attendanceLeave" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "submissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendanceLeave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendanceLeave_organizationId_date_idx" ON "attendance"."attendanceLeave"("organizationId", "date");

-- CreateIndex
CREATE INDEX "attendanceLeave_submissionId_idx" ON "attendance"."attendanceLeave"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "attendanceLeave_userId_date_key" ON "attendance"."attendanceLeave"("userId", "date");
