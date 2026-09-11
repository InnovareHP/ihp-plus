-- AlterTable
ALTER TABLE "clients"."client" ADD COLUMN     "serviceLine" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" TEXT;

-- CreateTable
CREATE TABLE "clients"."clientOption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientOption_organizationId_kind_archivedAt_idx" ON "clients"."clientOption"("organizationId", "kind", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "clientOption_organizationId_kind_value_key" ON "clients"."clientOption"("organizationId", "kind", "value");

