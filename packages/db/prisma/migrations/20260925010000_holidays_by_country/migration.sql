-- Holidays follow the shift: a shift names a country, a holiday names the country it is for.

-- AlterTable
ALTER TABLE "attendance"."attendanceShift" ADD COLUMN     "holidayCountry" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "attendance"."attendanceHoliday" ADD COLUMN     "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- DropIndex
DROP INDEX "attendance"."attendanceHoliday_organizationId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "attendanceHoliday_organizationId_date_country_key" ON "attendance"."attendanceHoliday"("organizationId", "date", "country");

-- CreateIndex
CREATE INDEX "attendanceHoliday_organizationId_date_idx" ON "attendance"."attendanceHoliday"("organizationId", "date");

-- CreateTable
CREATE TABLE "attendance"."attendanceHolidayImport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendanceHolidayImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendanceHolidayImport_organizationId_country_year_key" ON "attendance"."attendanceHolidayImport"("organizationId", "country", "year");
