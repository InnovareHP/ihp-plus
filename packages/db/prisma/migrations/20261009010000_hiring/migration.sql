-- Hiring: job postings, applications from the public careers pages, and their pipeline.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "hiring";

-- CreateTable
CREATE TABLE "hiring"."hiringSettings" (
    "organizationId" TEXT NOT NULL,
    "hrTeamId" TEXT,
    "defaultStages" JSONB NOT NULL DEFAULT '[]',
    "rejectionMessage" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hiringSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "hiring"."jobPosting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "teamId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "workplace" TEXT NOT NULL DEFAULT 'onsite',
    "employmentType" TEXT NOT NULL DEFAULT 'full_time',
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "resumeRequired" BOOLEAN NOT NULL DEFAULT true,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "applicationFormId" TEXT,
    "openedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring"."jobApplication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "postingTitle" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "values" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stageId" TEXT NOT NULL,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rejectionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'careers',
    "invitationId" TEXT,
    "hiredUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring"."applicationAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "applicationId" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring"."applicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring"."applicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobPosting_organizationId_status_idx" ON "hiring"."jobPosting"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jobPosting_organizationId_slug_key" ON "hiring"."jobPosting"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "jobApplication_organizationId_status_idx" ON "hiring"."jobApplication"("organizationId", "status");

-- CreateIndex
CREATE INDEX "jobApplication_postingId_status_stageId_idx" ON "hiring"."jobApplication"("postingId", "status", "stageId");

-- CreateIndex
CREATE INDEX "jobApplication_email_idx" ON "hiring"."jobApplication"("email");

-- CreateIndex
CREATE INDEX "applicationAttachment_applicationId_fieldId_idx" ON "hiring"."applicationAttachment"("applicationId", "fieldId");

-- CreateIndex
CREATE INDEX "applicationAttachment_applicationId_createdAt_idx" ON "hiring"."applicationAttachment"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "applicationEvent_applicationId_createdAt_idx" ON "hiring"."applicationEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "applicationNote_applicationId_createdAt_idx" ON "hiring"."applicationNote"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "hiring"."jobPosting" ADD CONSTRAINT "jobPosting_applicationFormId_fkey" FOREIGN KEY ("applicationFormId") REFERENCES "requests"."requestForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."jobApplication" ADD CONSTRAINT "jobApplication_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "hiring"."jobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."applicationAttachment" ADD CONSTRAINT "applicationAttachment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hiring"."jobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."applicationEvent" ADD CONSTRAINT "applicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hiring"."jobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."applicationNote" ADD CONSTRAINT "applicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hiring"."jobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

