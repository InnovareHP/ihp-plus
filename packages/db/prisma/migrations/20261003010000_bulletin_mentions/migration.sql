-- Who a bulletin post or reply mentioned, for their email and their unread badge.

-- CreateTable
CREATE TABLE "bulletin"."bulletinMention" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "commentId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulletinMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulletinMention_userId_createdAt_idx" ON "bulletin"."bulletinMention"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "bulletinMention_postId_idx" ON "bulletin"."bulletinMention"("postId");

-- CreateIndex
CREATE INDEX "bulletinMention_commentId_idx" ON "bulletin"."bulletinMention"("commentId");

-- AddForeignKey
ALTER TABLE "bulletin"."bulletinMention" ADD CONSTRAINT "bulletinMention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "bulletin"."bulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin"."bulletinMention" ADD CONSTRAINT "bulletinMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "bulletin"."bulletinComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

