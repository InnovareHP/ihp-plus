-- Who has confirmed reading which bluebook document.

-- CreateTable
CREATE TABLE "bluebook"."bluebookAcknowledgement" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bluebookAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bluebookAcknowledgement_userId_idx" ON "bluebook"."bluebookAcknowledgement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bluebookAcknowledgement_documentId_userId_key" ON "bluebook"."bluebookAcknowledgement"("documentId", "userId");

-- AddForeignKey
ALTER TABLE "bluebook"."bluebookAcknowledgement" ADD CONSTRAINT "bluebookAcknowledgement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "bluebook"."bluebookDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
