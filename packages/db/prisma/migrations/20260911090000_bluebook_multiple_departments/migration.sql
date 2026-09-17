-- A bluebook document sits on as many department shelves as it applies to, rather than one.
-- No rows is the company-wide shelf, which is exactly what a null teamId meant before.

-- CreateTable
CREATE TABLE "bluebook"."bluebookDocumentTeam" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,

    CONSTRAINT "bluebookDocumentTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bluebookDocumentTeam_teamId_idx" ON "bluebook"."bluebookDocumentTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "bluebookDocumentTeam_documentId_teamId_key" ON "bluebook"."bluebookDocumentTeam"("documentId", "teamId");

-- AddForeignKey
ALTER TABLE "bluebook"."bluebookDocumentTeam" ADD CONSTRAINT "bluebookDocumentTeam_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "bluebook"."bluebookDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry every existing shelf across before the columns holding it are dropped. A null teamId
-- becomes no rows, which is the same company-wide shelf it already was.
INSERT INTO "bluebook"."bluebookDocumentTeam" ("id", "documentId", "teamId", "teamName")
SELECT gen_random_uuid()::text, "id", "teamId", COALESCE("teamName", 'Removed department')
FROM "bluebook"."bluebookDocument"
WHERE "teamId" IS NOT NULL;

-- DropIndex
DROP INDEX "bluebook"."bluebookDocument_organizationId_teamId_archivedAt_idx";

-- CreateIndex
CREATE INDEX "bluebookDocument_organizationId_archivedAt_idx" ON "bluebook"."bluebookDocument"("organizationId", "archivedAt");

-- AlterTable
ALTER TABLE "bluebook"."bluebookDocument" DROP COLUMN "teamId",
DROP COLUMN "teamName";
