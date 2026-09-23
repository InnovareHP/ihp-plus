-- A checklist for each new hire: required reading, a finished profile, a shift and first-day tasks.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "onboarding";

-- CreateTable
CREATE TABLE "onboarding"."newHireChecklist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "closedById" TEXT,

    CONSTRAINT "newHireChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding"."newHireDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newHireDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding"."newHireTask" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newHireTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding"."newHireTaskCompletion" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newHireTaskCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "newHireChecklist_organizationId_completedAt_idx" ON "onboarding"."newHireChecklist"("organizationId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "newHireChecklist_organizationId_userId_key" ON "onboarding"."newHireChecklist"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "newHireDocument_organizationId_documentId_key" ON "onboarding"."newHireDocument"("organizationId", "documentId");

-- CreateIndex
CREATE INDEX "newHireTask_organizationId_archivedAt_idx" ON "onboarding"."newHireTask"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "newHireTaskCompletion_userId_idx" ON "onboarding"."newHireTaskCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "newHireTaskCompletion_taskId_userId_key" ON "onboarding"."newHireTaskCompletion"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "onboarding"."newHireDocument" ADD CONSTRAINT "newHireDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "bluebook"."bluebookDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding"."newHireTaskCompletion" ADD CONSTRAINT "newHireTaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "onboarding"."newHireTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Whoever finished setup in the last 30 days is still settling in, so they start with a checklist.
INSERT INTO "onboarding"."newHireChecklist" ("id", "organizationId", "userId", "startedAt")
SELECT gen_random_uuid()::text, m."organizationId", u."id", u."onboardingCompletedAt"
FROM "auth"."user" u
JOIN "auth"."member" m ON m."userId" = u."id"
WHERE u."onboardingCompletedAt" >= NOW() - INTERVAL '30 days'
ON CONFLICT ("organizationId", "userId") DO NOTHING;
