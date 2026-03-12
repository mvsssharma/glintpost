-- Rename enum EngagementType -> ChangelogEventType (Prisma uses @@map to keep DB name)
-- No SQL needed for enum rename since we use @@map("EngagementType")

-- No table rename needed since we use @@map("EngagementEvent") to keep DB table name

-- Truncate existing data for fresh start (old data lacks proper visitorIds)
TRUNCATE TABLE "EngagementEvent";
TRUNCATE TABLE "RoadmapVote";

-- Add unique constraint for per-user deduplication of LIKE/DISLIKE
CREATE UNIQUE INDEX "EngagementEvent_postId_visitorId_type_key" ON "EngagementEvent"("postId", "visitorId", "type");
