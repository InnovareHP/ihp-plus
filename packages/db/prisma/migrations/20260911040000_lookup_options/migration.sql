-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "lookups";

-- CreateTable
CREATE TABLE "lookups"."lookupOption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookupOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lookupOption_organizationId_kind_archivedAt_idx" ON "lookups"."lookupOption"("organizationId", "kind", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "lookupOption_organizationId_kind_value_key" ON "lookups"."lookupOption"("organizationId", "kind", "value");
