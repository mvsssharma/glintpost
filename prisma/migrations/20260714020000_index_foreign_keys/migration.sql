-- Index the three foreign keys that had no covering index. Postgres does not
-- create these automatically (unlike for primary keys / unique constraints), so
-- the ON DELETE CASCADE from User -> Account/Session and the ON DELETE SET NULL
-- from RoadmapItem -> RoadmapSuggestion each required a sequential scan.
--
-- Every other FK already rides the leading column of an existing composite index.

CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "RoadmapSuggestion_matchedItemId_idx" ON "RoadmapSuggestion"("matchedItemId");
