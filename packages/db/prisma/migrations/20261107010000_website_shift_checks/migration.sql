-- The IT lead's hand checks per site per shift: pages and buttons, form email, findings and action.

-- CreateTable
CREATE TABLE "websites"."websiteShiftCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "pagesButtons" TEXT NOT NULL DEFAULT '',
    "formEmail" TEXT NOT NULL DEFAULT '',
    "formEmailAt" TIMESTAMP(3),
    "findings" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "checkedById" TEXT NOT NULL,
    "checkedByName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "websiteShiftCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "websiteShiftCheck_organizationId_workDate_idx" ON "websites"."websiteShiftCheck"("organizationId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "websiteShiftCheck_websiteId_workDate_key" ON "websites"."websiteShiftCheck"("websiteId", "workDate");

-- AddForeignKey
ALTER TABLE "websites"."websiteShiftCheck" ADD CONSTRAINT "websiteShiftCheck_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "websites"."website"("id") ON DELETE CASCADE ON UPDATE CASCADE;
