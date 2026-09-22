-- Shifts become a thing of their own: written once by name, assigned to as many people as work
-- them. The per-person schedule keeps only who works which shift.

-- Writing a day is admin-only now, so the setting that let members do it says nothing.
ALTER TABLE "attendance"."attendanceSettings" DROP COLUMN IF EXISTS "allowManualEntry";

-- CreateTable
CREATE TABLE "attendance"."attendanceShift" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shiftStartMinutes" INTEGER NOT NULL,
    "shiftEndMinutes" INTEGER NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "workdays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendanceShift_organizationId_name_key" ON "attendance"."attendanceShift"("organizationId", "name");

-- CreateIndex
CREATE INDEX "attendanceShift_organizationId_idx" ON "attendance"."attendanceShift"("organizationId");

-- Every schedule written before this migration becomes a shift named after its hours, so no
-- assignment is lost on the way across.
INSERT INTO "attendance"."attendanceShift" ("id", "organizationId", "name", "shiftStartMinutes", "shiftEndMinutes", "graceMinutes", "workdays", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "organizationId",
    lpad(("shiftStartMinutes" / 60)::text, 2, '0') || ':' || lpad(("shiftStartMinutes" % 60)::text, 2, '0')
        || ' - ' ||
    lpad(("shiftEndMinutes" / 60)::text, 2, '0') || ':' || lpad(("shiftEndMinutes" % 60)::text, 2, '0'),
    "shiftStartMinutes",
    "shiftEndMinutes",
    "graceMinutes",
    "workdays",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "attendance"."attendanceSchedule"
GROUP BY "organizationId", "shiftStartMinutes", "shiftEndMinutes", "graceMinutes", "workdays";

-- AlterTable
ALTER TABLE "attendance"."attendanceSchedule" ADD COLUMN "shiftId" TEXT;

UPDATE "attendance"."attendanceSchedule" AS schedule
SET "shiftId" = shift."id"
FROM "attendance"."attendanceShift" AS shift
WHERE shift."organizationId" = schedule."organizationId"
  AND shift."shiftStartMinutes" = schedule."shiftStartMinutes"
  AND shift."shiftEndMinutes" = schedule."shiftEndMinutes"
  AND shift."graceMinutes" = schedule."graceMinutes"
  AND shift."workdays" = schedule."workdays";

-- A schedule with no shift behind it says nothing, so the column is required from here on.
DELETE FROM "attendance"."attendanceSchedule" WHERE "shiftId" IS NULL;

ALTER TABLE "attendance"."attendanceSchedule" ALTER COLUMN "shiftId" SET NOT NULL;

ALTER TABLE "attendance"."attendanceSchedule"
    DROP COLUMN "shiftStartMinutes",
    DROP COLUMN "shiftEndMinutes",
    DROP COLUMN "graceMinutes",
    DROP COLUMN "workdays";

-- CreateIndex
CREATE INDEX "attendanceSchedule_shiftId_idx" ON "attendance"."attendanceSchedule"("shiftId");

-- AddForeignKey
ALTER TABLE "attendance"."attendanceSchedule" ADD CONSTRAINT "attendanceSchedule_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "attendance"."attendanceShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
