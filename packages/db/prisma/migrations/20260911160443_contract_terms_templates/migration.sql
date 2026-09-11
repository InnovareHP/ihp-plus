-- AlterTable
ALTER TABLE "contracts"."catalogItem" ADD COLUMN     "defaultTerms" TEXT;

-- CreateTable
CREATE TABLE "contracts"."contractTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scopeTemplate" TEXT NOT NULL,
    "standardTerms" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractTemplate_organizationId_key" ON "contracts"."contractTemplate"("organizationId");

