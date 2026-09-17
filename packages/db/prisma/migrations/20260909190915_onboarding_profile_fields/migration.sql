-- AlterTable
ALTER TABLE "user" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "department" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "middleInitial" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredName" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);
