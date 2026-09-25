-- Posts an admin asks everyone to confirm reading, and who has.

-- AlterTable
ALTER TABLE "bulletin"."bulletinPost" ADD COLUMN     "requiresAck" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "bulletin"."bulletinAcknowledgement" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulletinAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulletinAcknowledgement_userId_idx" ON "bulletin"."bulletinAcknowledgement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bulletinAcknowledgement_postId_userId_key" ON "bulletin"."bulletinAcknowledgement"("postId", "userId");

-- AddForeignKey
ALTER TABLE "bulletin"."bulletinAcknowledgement" ADD CONSTRAINT "bulletinAcknowledgement_postId_fkey" FOREIGN KEY ("postId") REFERENCES "bulletin"."bulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

