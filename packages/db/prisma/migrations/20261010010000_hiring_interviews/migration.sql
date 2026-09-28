-- Interviews: slots offered to an applicant, the one they booked, and each interviewer's scorecard.

-- AlterTable
ALTER TABLE "hiring"."hiringSettings" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Manila';

-- AlterTable
ALTER TABLE "hiring"."jobPosting" ADD COLUMN     "scorecardFormId" TEXT;

-- CreateTable
CREATE TABLE "hiring"."interview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "durationMinutes" INTEGER NOT NULL,
    "interviewerIds" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'offered',
    "bookedStart" TIMESTAMP(3),
    "bookedEnd" TIMESTAMP(3),
    "applicantTimeZone" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "calendarEventId" TEXT,
    "joinUrl" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "feedbackAskedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring"."interviewSlot" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiring"."interviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "values" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interview_applicationId_idx" ON "hiring"."interview"("applicationId");

-- CreateIndex
CREATE INDEX "interview_organizationId_status_bookedStart_idx" ON "hiring"."interview"("organizationId", "status", "bookedStart");

-- CreateIndex
CREATE INDEX "interviewSlot_interviewId_start_idx" ON "hiring"."interviewSlot"("interviewId", "start");

-- CreateIndex
CREATE UNIQUE INDEX "interviewFeedback_interviewId_interviewerId_key" ON "hiring"."interviewFeedback"("interviewId", "interviewerId");

-- AddForeignKey
ALTER TABLE "hiring"."jobPosting" ADD CONSTRAINT "jobPosting_scorecardFormId_fkey" FOREIGN KEY ("scorecardFormId") REFERENCES "requests"."requestForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."interview" ADD CONSTRAINT "interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hiring"."jobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."interviewSlot" ADD CONSTRAINT "interviewSlot_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "hiring"."interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiring"."interviewFeedback" ADD CONSTRAINT "interviewFeedback_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "hiring"."interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

