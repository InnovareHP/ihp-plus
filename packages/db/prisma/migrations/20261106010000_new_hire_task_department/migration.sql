-- A first-day task can belong to one department; null keeps it on every new hire's list.

-- AlterTable
ALTER TABLE "onboarding"."newHireTask" ADD COLUMN     "teamId" TEXT;
