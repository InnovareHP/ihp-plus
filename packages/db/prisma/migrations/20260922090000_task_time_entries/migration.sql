-- Hours against a task. A row with no endedAt is a timer still running; one with both ends is
-- work already recorded, timed or typed in afterwards.

-- CreateTable
CREATE TABLE "tasks"."taskTimeEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taskTimeEntry_taskId_startedAt_idx" ON "tasks"."taskTimeEntry"("taskId", "startedAt");

-- CreateIndex
CREATE INDEX "taskTimeEntry_userId_endedAt_idx" ON "tasks"."taskTimeEntry"("userId", "endedAt");

-- AddForeignKey
ALTER TABLE "tasks"."taskTimeEntry" ADD CONSTRAINT "taskTimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "tasks"."taskTimeSettings" (
    "organizationId" TEXT NOT NULL,
    "allowManualEntry" BOOLEAN NOT NULL DEFAULT true,
    "allowSelfEdit" BOOLEAN NOT NULL DEFAULT true,
    "requireNote" BOOLEAN NOT NULL DEFAULT false,
    "trackOnlyAssigned" BOOLEAN NOT NULL DEFAULT false,
    "autoStopHours" INTEGER NOT NULL DEFAULT 12,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskTimeSettings_pkey" PRIMARY KEY ("organizationId")
);
