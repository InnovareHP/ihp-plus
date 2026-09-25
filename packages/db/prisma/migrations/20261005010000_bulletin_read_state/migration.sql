-- When each person last opened the bulletin board, for the unread badge.

-- CreateTable
CREATE TABLE "bulletin"."bulletinReadState" (
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletinReadState_pkey" PRIMARY KEY ("organizationId","userId")
);

