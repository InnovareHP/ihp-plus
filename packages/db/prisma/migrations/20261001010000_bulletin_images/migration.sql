-- Photos on bulletin posts.

-- CreateTable
CREATE TABLE "bulletin"."bulletinImage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postId" TEXT,
    "fileKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulletinImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulletinImage_postId_position_idx" ON "bulletin"."bulletinImage"("postId", "position");

-- CreateIndex
CREATE INDEX "bulletinImage_organizationId_uploadedById_idx" ON "bulletin"."bulletinImage"("organizationId", "uploadedById");

-- AddForeignKey
ALTER TABLE "bulletin"."bulletinImage" ADD CONSTRAINT "bulletinImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "bulletin"."bulletinPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
