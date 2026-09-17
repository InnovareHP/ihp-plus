-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "contracts";

-- CreateTable
CREATE TABLE "contracts"."catalogItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMinCents" INTEGER NOT NULL,
    "priceMaxCents" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'project',
    "percentOfSpend" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts"."contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "terms" TEXT,
    "signedAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts"."contractLine" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitPriceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'project',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contractLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalogItem_organizationId_category_archivedAt_idx" ON "contracts"."catalogItem"("organizationId", "category", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "catalogItem_organizationId_category_name_key" ON "contracts"."catalogItem"("organizationId", "category", "name");

-- CreateIndex
CREATE INDEX "contract_organizationId_status_archivedAt_idx" ON "contracts"."contract"("organizationId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "contract_clientId_idx" ON "contracts"."contract"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_organizationId_reference_key" ON "contracts"."contract"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "contractLine_contractId_idx" ON "contracts"."contractLine"("contractId");

-- AddForeignKey
ALTER TABLE "contracts"."contractLine" ADD CONSTRAINT "contractLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"."contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

