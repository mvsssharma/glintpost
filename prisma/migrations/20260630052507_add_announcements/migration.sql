-- CreateEnum
CREATE TYPE "AnnouncementDisplayType" AS ENUM ('OVERLAY', 'TOP_BANNER');

-- CreateEnum
CREATE TYPE "AnnouncementEventType" AS ENUM ('VIEW', 'CLICK');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "displayType" "AnnouncementDisplayType" NOT NULL DEFAULT 'OVERLAY',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "targetingRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "type" "AnnouncementEventType" NOT NULL,
    "visitorId" TEXT,
    "plan" TEXT,
    "role" TEXT,
    "region" TEXT,
    "platform" TEXT,
    "version" TEXT,
    "company" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_orgId_status_idx" ON "Announcement"("orgId", "status");

-- CreateIndex
CREATE INDEX "Announcement_orgId_startDate_endDate_idx" ON "Announcement"("orgId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "AnnouncementEvent_orgId_announcementId_idx" ON "AnnouncementEvent"("orgId", "announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementEvent_orgId_createdAt_idx" ON "AnnouncementEvent"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementEvent_announcementId_visitorId_type_key" ON "AnnouncementEvent"("announcementId", "visitorId", "type");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementEvent" ADD CONSTRAINT "AnnouncementEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementEvent" ADD CONSTRAINT "AnnouncementEvent_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
