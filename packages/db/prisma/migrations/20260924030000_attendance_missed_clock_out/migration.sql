-- A day the clock closed on its own is flagged, so the timesheet can say the clock-out was missed.

-- AlterTable
ALTER TABLE "attendance"."attendanceDay" ADD COLUMN "autoClosed" BOOLEAN NOT NULL DEFAULT false;

-- Days closed before this column existed carry the note the auto-close wrote.
UPDATE "attendance"."attendanceDay" SET "autoClosed" = true WHERE "note" = 'Closed automatically.' AND "source" = 'clock';
