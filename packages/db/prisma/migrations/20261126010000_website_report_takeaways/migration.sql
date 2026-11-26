-- CreateTable
CREATE TABLE "websites"."websiteReportTakeaways" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteKey" TEXT NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "observations" TEXT NOT NULL DEFAULT '',
    "strengths" TEXT NOT NULL DEFAULT '',
    "improvements" TEXT NOT NULL DEFAULT '',
    "recommendations" TEXT NOT NULL DEFAULT '',
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websiteReportTakeaways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "websiteReportTakeaways_organizationId_siteKey_start_end_key" ON "websites"."websiteReportTakeaways"("organizationId", "siteKey", "start", "end");
