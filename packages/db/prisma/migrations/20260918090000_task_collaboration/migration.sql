-- Comments, mentions and file attachments on a task: the collaboration half the first tasks
-- migration deliberately left out.

-- CreateTable
CREATE TABLE "tasks"."taskComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks"."taskCommentMention" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taskCommentMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks"."taskAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "commentId" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taskComment_taskId_createdAt_idx" ON "tasks"."taskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "taskComment_organizationId_idx" ON "tasks"."taskComment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "taskCommentMention_commentId_userId_key" ON "tasks"."taskCommentMention"("commentId", "userId");

-- CreateIndex
CREATE INDEX "taskCommentMention_userId_readAt_idx" ON "tasks"."taskCommentMention"("userId", "readAt");

-- CreateIndex
CREATE INDEX "taskAttachment_taskId_createdAt_idx" ON "tasks"."taskAttachment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "taskAttachment_commentId_idx" ON "tasks"."taskAttachment"("commentId");

-- AddForeignKey
ALTER TABLE "tasks"."taskComment" ADD CONSTRAINT "taskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."taskCommentMention" ADD CONSTRAINT "taskCommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "tasks"."taskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."taskAttachment" ADD CONSTRAINT "taskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"."task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."taskAttachment" ADD CONSTRAINT "taskAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "tasks"."taskComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
