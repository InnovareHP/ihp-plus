-- Client websites the IT department watches, and the lead's clock-in and clock-out checks.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "websites";

-- CreateTable
CREATE TABLE "websites"."websiteSettings" (
    "organizationId" TEXT NOT NULL,
    "itTeamId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websiteSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "websites"."website" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "websites"."websiteCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "round" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "responseMs" INTEGER,
    "error" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "checkedById" TEXT NOT NULL,
    "checkedByName" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websiteCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_organizationId_archivedAt_idx" ON "websites"."website"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "website_clientId_idx" ON "websites"."website"("clientId");

-- CreateIndex
CREATE INDEX "websiteCheck_organizationId_workDate_idx" ON "websites"."websiteCheck"("organizationId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "websiteCheck_websiteId_workDate_round_key" ON "websites"."websiteCheck"("websiteId", "workDate", "round");

-- AddForeignKey
ALTER TABLE "websites"."websiteCheck" ADD CONSTRAINT "websiteCheck_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"."website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
