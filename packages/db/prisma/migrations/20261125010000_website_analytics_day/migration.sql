-- CreateTable
CREATE TABLE "websites"."websiteAnalyticsDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "netlifySiteId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "visitors" INTEGER NOT NULL,
    "bandwidthBytes" BIGINT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "pages" JSONB NOT NULL DEFAULT '[]',
    "countries" JSONB NOT NULL DEFAULT '[]',
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "websiteAnalyticsDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "websiteAnalyticsDay_organizationId_day_idx" ON "websites"."websiteAnalyticsDay"("organizationId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "websiteAnalyticsDay_netlifySiteId_day_key" ON "websites"."websiteAnalyticsDay"("netlifySiteId", "day");
