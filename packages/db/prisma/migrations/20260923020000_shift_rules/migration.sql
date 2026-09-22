-- The clock's rules belong to the shift they measure, not to the company: a night shift can ask
-- for a selfie while the office shift does not. The company keeps only the zone its day is
-- counted in, and which shift somebody works until they are given one of their own.

-- AlterTable
ALTER TABLE "attendance"."attendanceShift"
    ADD COLUMN "requireSelfie" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "requireNote" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "captureLocation" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "autoClockOutHours" INTEGER NOT NULL DEFAULT 16;

-- Every shift inherits the rules the company was running under, so nothing changes on the floor.
UPDATE "attendance"."attendanceShift" AS shift
SET "requireSelfie" = settings."requireSelfie",
    "requireNote" = settings."requireNote",
    "captureLocation" = settings."captureLocation",
    "autoClockOutHours" = settings."autoClockOutHours"
FROM "attendance"."attendanceSettings" AS settings
WHERE settings."organizationId" = shift."organizationId";

-- AlterTable
ALTER TABLE "attendance"."attendanceSettings" ADD COLUMN "defaultShiftId" TEXT;

-- The company hours become a shift like any other, named for what people already call them.
INSERT INTO "attendance"."attendanceShift" ("id", "organizationId", "name", "shiftStartMinutes", "shiftEndMinutes", "graceMinutes", "workdays", "requireSelfie", "requireNote", "captureLocation", "autoClockOutHours", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    settings."organizationId",
    'Company hours',
    settings."shiftStartMinutes",
    settings."shiftEndMinutes",
    settings."graceMinutes",
    settings."workdays",
    settings."requireSelfie",
    settings."requireNote",
    settings."captureLocation",
    settings."autoClockOutHours",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "attendance"."attendanceSettings" AS settings
WHERE NOT EXISTS (
    SELECT 1 FROM "attendance"."attendanceShift" AS shift
    WHERE shift."organizationId" = settings."organizationId" AND shift."name" = 'Company hours'
);

UPDATE "attendance"."attendanceSettings" AS settings
SET "defaultShiftId" = shift."id"
FROM "attendance"."attendanceShift" AS shift
WHERE shift."organizationId" = settings."organizationId" AND shift."name" = 'Company hours';

ALTER TABLE "attendance"."attendanceSettings"
    DROP COLUMN "requireSelfie",
    DROP COLUMN "requireNote",
    DROP COLUMN "captureLocation",
    DROP COLUMN "autoClockOutHours",
    DROP COLUMN "shiftStartMinutes",
    DROP COLUMN "shiftEndMinutes",
    DROP COLUMN "graceMinutes",
    DROP COLUMN "workdays";

-- AddForeignKey
ALTER TABLE "attendance"."attendanceSettings" ADD CONSTRAINT "attendanceSettings_defaultShiftId_fkey" FOREIGN KEY ("defaultShiftId") REFERENCES "attendance"."attendanceShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
