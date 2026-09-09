-- AlterTable
ALTER TABLE "user" DROP COLUMN "employeeId",
ADD COLUMN     "ihpId" TEXT,
ADD COLUMN     "photoKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_ihpId_key" ON "user"("ihpId");
