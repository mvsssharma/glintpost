-- CreateTable
CREATE TABLE "RoadmapView" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "visitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoadmapView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapView_orgId_createdAt_idx" ON "RoadmapView"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoadmapView" ADD CONSTRAINT "RoadmapView_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
