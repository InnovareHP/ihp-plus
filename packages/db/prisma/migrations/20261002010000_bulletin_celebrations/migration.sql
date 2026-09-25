-- Posts the portal writes itself (birthdays, work anniversaries, welcomes) and the switches for them.

-- AlterTable
ALTER TABLE "bulletin"."bulletinPost" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'post',
ADD COLUMN     "occasionKey" TEXT,
ADD COLUMN     "subjectUserId" TEXT,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "bulletin"."bulletinSettings" (
    "organizationId" TEXT NOT NULL,
    "celebrateBirthdays" BOOLEAN NOT NULL DEFAULT true,
    "celebrateAnniversaries" BOOLEAN NOT NULL DEFAULT true,
    "welcomeNewHires" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletinSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "bulletinPost_organizationId_occasionKey_key" ON "bulletin"."bulletinPost"("organizationId", "occasionKey");

