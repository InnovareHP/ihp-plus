-- A posting's pay range says what it is paid per, since monthly and hourly pay are common.

-- AlterTable
ALTER TABLE "hiring"."jobPosting" ADD COLUMN     "salaryPeriod" TEXT NOT NULL DEFAULT 'year';
