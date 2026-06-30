-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "enabledWidgets" TEXT[] DEFAULT ARRAY['changelog', 'roadmap', 'feedback', 'announcements']::TEXT[];
