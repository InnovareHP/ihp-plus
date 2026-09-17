-- What happened to each contract and request, append-only.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "activity";

-- CreateTable
CREATE TABLE "activity"."activityEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activityEvent_subjectType_subjectId_createdAt_idx" ON "activity"."activityEvent"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "activityEvent_organizationId_createdAt_idx" ON "activity"."activityEvent"("organizationId", "createdAt");
