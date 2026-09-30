-- Who a statement's email draft is addressed to, remembered for the next one.

-- AlterTable
ALTER TABLE "attendance"."attendanceStatement" ADD COLUMN "sendTo" TEXT NOT NULL DEFAULT '';
