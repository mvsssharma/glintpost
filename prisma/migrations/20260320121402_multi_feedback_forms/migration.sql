-- DropIndex
DROP INDEX "FeedbackForm_orgId_key";

-- CreateIndex
CREATE INDEX "FeedbackForm_orgId_idx" ON "FeedbackForm"("orgId");
