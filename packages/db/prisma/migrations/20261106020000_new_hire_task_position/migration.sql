-- A first-day task can belong to one position, stored as the lookup text like user.jobTitle.

-- AlterTable
ALTER TABLE "onboarding"."newHireTask" ADD COLUMN     "position" TEXT;
