-- A subtask is a task with a parent, one level deep: the board lists parents, the detail panel
-- lists their children. Cascading means deleting a task takes its checklist with it.

-- AlterTable
ALTER TABLE "tasks"."task" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "task_parentId_idx" ON "tasks"."task"("parentId");

-- AddForeignKey
ALTER TABLE "tasks"."task" ADD CONSTRAINT "task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
