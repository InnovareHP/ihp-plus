-- Company holidays: a scheduled day nobody is expected to clock, so it never reads as absent.

-- CreateTable
CREATE TABLE "attendance"."attendanceHoliday" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendanceHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendanceHoliday_organizationId_date_key" ON "attendance"."attendanceHoliday"("organizationId", "date");
