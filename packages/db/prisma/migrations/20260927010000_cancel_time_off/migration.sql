-- Approved time off can be cancelled: a submission remembers it booked leave, and who took it back.

-- AlterTable
ALTER TABLE "requests"."requestSubmission" ADD COLUMN     "cancellationNote" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "timeOff" BOOLEAN NOT NULL DEFAULT false;

-- Requests raised before the snapshot existed take the flag their form carries now.
UPDATE "requests"."requestSubmission" AS submission
SET "timeOff" = true
FROM "requests"."requestForm" AS form
WHERE form."id" = submission."formId" AND form."timeOff" = true;
