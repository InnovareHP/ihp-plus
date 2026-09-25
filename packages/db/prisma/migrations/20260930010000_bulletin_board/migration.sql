-- The company bulletin board: posts, their replies, and reactions.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "bulletin";

-- CreateTable
CREATE TABLE "bulletin"."bulletinPost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "pinnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletinPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin"."bulletinComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletinComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin"."bulletinReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulletinReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulletinPost_organizationId_pinnedAt_createdAt_idx" ON "bulletin"."bulletinPost"("organizationId", "pinnedAt", "createdAt");

-- CreateIndex
CREATE INDEX "bulletinComment_postId_createdAt_idx" ON "bulletin"."bulletinComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "bulletinReaction_postId_idx" ON "bulletin"."bulletinReaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "bulletinReaction_postId_userId_emoji_key" ON "bulletin"."bulletinReaction"("postId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "bulletin"."bulletinComment" ADD CONSTRAINT "bulletinComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "bulletin"."bulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin"."bulletinReaction" ADD CONSTRAINT "bulletinReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "bulletin"."bulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
