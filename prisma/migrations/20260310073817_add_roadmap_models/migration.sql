-- CreateEnum
CREATE TYPE "RoadmapItemStatus" AS ENUM ('UNDER_REVIEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'MERGED', 'CREATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "VoteType" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RoadmapItemStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapSuggestion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "visitorId" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "matchedItemId" TEXT,
    "similarityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapVote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "voteType" "VoteType" NOT NULL DEFAULT 'UP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapItem_orgId_status_idx" ON "RoadmapItem"("orgId", "status");

-- CreateIndex
CREATE INDEX "RoadmapItem_orgId_createdAt_idx" ON "RoadmapItem"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "RoadmapSuggestion_orgId_status_idx" ON "RoadmapSuggestion"("orgId", "status");

-- CreateIndex
CREATE INDEX "RoadmapSuggestion_orgId_createdAt_idx" ON "RoadmapSuggestion"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "RoadmapVote_orgId_itemId_idx" ON "RoadmapVote"("orgId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapVote_itemId_visitorId_key" ON "RoadmapVote"("itemId", "visitorId");

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapSuggestion" ADD CONSTRAINT "RoadmapSuggestion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapSuggestion" ADD CONSTRAINT "RoadmapSuggestion_matchedItemId_fkey" FOREIGN KEY ("matchedItemId") REFERENCES "RoadmapItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapVote" ADD CONSTRAINT "RoadmapVote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapVote" ADD CONSTRAINT "RoadmapVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
