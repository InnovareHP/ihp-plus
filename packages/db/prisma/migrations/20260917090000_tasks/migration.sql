-- Task boards: a project holds lists, a list holds tasks, and statuses are shared across the
-- organization.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tasks";

-- CreateTable
CREATE TABLE "tasks"."taskProject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "taskCounter" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks"."taskList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks"."taskStatus" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks"."task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "taskNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "position" DOUBLE PRECISION NOT NULL,
    "completedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks"."taskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taskProject_organizationId_isArchived_idx" ON "tasks"."taskProject"("organizationId", "isArchived");

-- CreateIndex
CREATE INDEX "taskList_projectId_idx" ON "tasks"."taskList"("projectId");

-- CreateIndex
CREATE INDEX "taskList_organizationId_idx" ON "tasks"."taskList"("organizationId");

-- CreateIndex
CREATE INDEX "taskStatus_organizationId_idx" ON "tasks"."taskStatus"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "taskStatus_organizationId_name_key" ON "tasks"."taskStatus"("organizationId", "name");

-- CreateIndex
CREATE INDEX "task_organizationId_listId_isArchived_idx" ON "tasks"."task"("organizationId", "listId", "isArchived");

-- CreateIndex
CREATE INDEX "task_statusId_idx" ON "tasks"."task"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "task_projectId_taskNumber_key" ON "tasks"."task"("projectId", "taskNumber");

-- CreateIndex
CREATE INDEX "taskAssignee_userId_idx" ON "tasks"."taskAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "taskAssignee_taskId_userId_key" ON "tasks"."taskAssignee"("taskId", "userId");

-- AddForeignKey
ALTER TABLE "tasks"."taskList" ADD CONSTRAINT "taskList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "tasks"."taskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "tasks"."taskProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."task" ADD CONSTRAINT "task_listId_fkey" FOREIGN KEY ("listId") REFERENCES "tasks"."taskList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."task" ADD CONSTRAINT "task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "tasks"."taskStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."taskAssignee" ADD CONSTRAINT "taskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
