-- Offers: what HR sends an applicant in the offer stage, and how the applicant answered.

-- CreateTable
CREATE TABLE "hiring"."jobOffer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "message" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "fileSize" INTEGER,
    "declineReason" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobOffer_applicationId_createdAt_idx" ON "hiring"."jobOffer"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "hiring"."jobOffer" ADD CONSTRAINT "jobOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hiring"."jobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
