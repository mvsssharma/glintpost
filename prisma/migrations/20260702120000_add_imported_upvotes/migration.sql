-- AlterTable
ALTER TABLE "RoadmapItem" ADD COLUMN "importedUpvotes" INTEGER NOT NULL DEFAULT 0;

-- Roll up any legacy synthetic import votes into importedUpvotes, then remove them
UPDATE "RoadmapItem" ri
SET "importedUpvotes" = sub.cnt
FROM (
  SELECT "itemId", COUNT(*)::int AS cnt
  FROM "RoadmapVote"
  WHERE "visitorId" LIKE 'import-%' AND "voteType" = 'UP'
  GROUP BY "itemId"
) sub
WHERE ri.id = sub."itemId";

DELETE FROM "RoadmapVote" WHERE "visitorId" LIKE 'import-%';
