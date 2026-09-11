-- Stripe's side of the money. Nothing here is a second ledger: Stripe owns the amounts, and
-- every column is written from a webhook.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "billing";

-- CreateTable
CREATE TABLE "billing"."stripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing"."stripeInvoice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "status" TEXT NOT NULL,
    "amountDueCents" INTEGER NOT NULL,
    "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "hostedInvoiceUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripeInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripeEvent_type_processedAt_idx" ON "billing"."stripeEvent"("type", "processedAt");

-- CreateIndex
CREATE INDEX "stripeInvoice_contractId_idx" ON "billing"."stripeInvoice"("contractId");

-- CreateIndex
CREATE INDEX "stripeInvoice_customerId_idx" ON "billing"."stripeInvoice"("customerId");
