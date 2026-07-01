-- AlterTable: add orgId as nullable first so we can backfill existing rows
ALTER TABLE "PostTranslation" ADD COLUMN "orgId" TEXT;

-- Backfill orgId from the parent Post
UPDATE "PostTranslation" pt
SET "orgId" = p."orgId"
FROM "Post" p
WHERE pt."postId" = p."id";

-- Enforce NOT NULL now that every row is backfilled
ALTER TABLE "PostTranslation" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "PostTranslation_orgId_idx" ON "PostTranslation"("orgId");

-- AddForeignKey
ALTER TABLE "PostTranslation" ADD CONSTRAINT "PostTranslation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
