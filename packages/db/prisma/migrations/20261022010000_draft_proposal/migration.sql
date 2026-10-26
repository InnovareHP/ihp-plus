-- The proposal file a contract draft is based on.

-- AlterTable
ALTER TABLE "drafts"."draft" ADD COLUMN     "proposal" BYTEA,
ADD COLUMN     "proposalFormat" TEXT,
ADD COLUMN     "proposalName" TEXT;
