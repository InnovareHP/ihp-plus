-- Statements bill hours × an hourly rate instead of days × a daily rate.

-- AlterTable
ALTER TABLE "attendance"."attendanceStatement" RENAME COLUMN "dailyRateCents" TO "hourlyRateCents";

-- Older statements keep the pay they billed, spread over the hours they recorded.
UPDATE "attendance"."attendanceStatement"
SET "hourlyRateCents" = ROUND(("hourlyRateCents" * "daysWorked") / "hoursWorked")
WHERE NOT "fixedPay" AND "hoursWorked" > 0;
