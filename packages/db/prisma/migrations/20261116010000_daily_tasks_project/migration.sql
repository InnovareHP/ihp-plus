-- The daily tasks project is found by key and holds one list per member.

-- AlterTable
ALTER TABLE "tasks"."taskProject" ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "tasks"."taskList" ADD COLUMN     "ownerId" TEXT;

-- Adopt a daily tasks project created by name before this column existed.
UPDATE "tasks"."taskProject" SET "systemKey" = 'daily'
WHERE "id" IN (
  SELECT DISTINCT ON ("organizationId") "id" FROM "tasks"."taskProject"
  WHERE "name" = 'Daily tasks' ORDER BY "organizationId", "createdAt"
);

-- CreateIndex
CREATE UNIQUE INDEX "taskProject_organizationId_systemKey_key" ON "tasks"."taskProject"("organizationId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "taskList_projectId_ownerId_key" ON "tasks"."taskList"("projectId", "ownerId");
