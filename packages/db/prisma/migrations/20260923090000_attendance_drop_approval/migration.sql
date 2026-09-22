-- The per-day sign-off is gone: nothing read it, nothing was locked by it, and payroll reads the
-- range rather than the flag. A day is open while the clock runs and recorded once it stops.

UPDATE "attendance"."attendanceDay" SET "status" = 'recorded' WHERE "status" = 'approved';

ALTER TABLE "attendance"."attendanceDay"
    DROP COLUMN "approvedById",
    DROP COLUMN "approvedAt";
