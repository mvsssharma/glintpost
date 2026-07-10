/*
  Warnings:

  - You are about to drop the column `targetingRules` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `targetingRules` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "targetingRules",
ADD COLUMN     "audienceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "audienceMatch" TEXT NOT NULL DEFAULT 'OR';

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "targetingRules",
ADD COLUMN     "audienceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "audienceMatch" TEXT NOT NULL DEFAULT 'OR';

-- CreateTable
CREATE TABLE "Attribute" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservedAttribute" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "inferredType" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservedAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attribute_orgId_idx" ON "Attribute"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Attribute_orgId_key_key" ON "Attribute"("orgId", "key");

-- CreateIndex
CREATE INDEX "Audience_orgId_idx" ON "Audience"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Audience_orgId_name_key" ON "Audience"("orgId", "name");

-- CreateIndex
CREATE INDEX "ObservedAttribute_orgId_idx" ON "ObservedAttribute"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservedAttribute_orgId_key_key" ON "ObservedAttribute"("orgId", "key");

-- AddForeignKey
ALTER TABLE "Attribute" ADD CONSTRAINT "Attribute_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservedAttribute" ADD CONSTRAINT "ObservedAttribute_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
