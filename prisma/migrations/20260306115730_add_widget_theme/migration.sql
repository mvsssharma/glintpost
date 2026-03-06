-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "widgetTheme" TEXT NOT NULL DEFAULT 'light',
ALTER COLUMN "primaryColor" SET DEFAULT '#10b981';
