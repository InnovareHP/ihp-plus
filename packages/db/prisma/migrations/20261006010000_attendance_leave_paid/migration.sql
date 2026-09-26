-- Whether a day of leave is paid, so an admin can grant an unpaid day off.

-- AlterTable
ALTER TABLE "attendance"."attendanceLeave" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT true;

-- Days granted before the choice existed were paid, and now say so on the timesheet.
UPDATE "attendance"."attendanceLeave" SET "name" = 'Paid day off' WHERE "submissionId" IS NULL AND "name" = 'Day off';
