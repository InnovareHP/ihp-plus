-- Request forms can ask for a file; the Expense reimbursement receipt becomes an upload.

-- CreateTable
CREATE TABLE "requests"."requestAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "submissionId" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requestAttachment_submissionId_fieldId_idx" ON "requests"."requestAttachment"("submissionId", "fieldId");

-- CreateIndex
CREATE INDEX "requestAttachment_uploadedById_submissionId_idx" ON "requests"."requestAttachment"("uploadedById", "submissionId");

-- AddForeignKey
ALTER TABLE "requests"."requestAttachment" ADD CONSTRAINT "requestAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "requests"."requestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seeded forms are skipped once they exist, so the live Expense reimbursement form is moved here.
UPDATE "requests"."requestForm"
SET "fields" = (
    SELECT jsonb_agg(
        CASE WHEN element->>'id' = 'receipt'
            THEN element
                || jsonb_build_object(
                    'type', 'file',
                    'label', 'Receipt',
                    'help', 'A photo or PDF of the receipt or invoice, up to 25 MB.',
                    'placeholder', ''
                )
            ELSE element
        END
        ORDER BY position
    )
    FROM jsonb_array_elements("fields") WITH ORDINALITY AS item(element, position)
)
WHERE "name" = 'Expense reimbursement'
  AND "kind" = 'request'
  AND jsonb_typeof("fields") = 'array'
  AND jsonb_array_length("fields") > 0;
