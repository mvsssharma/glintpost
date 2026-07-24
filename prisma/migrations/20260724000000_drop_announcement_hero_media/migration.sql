-- Drop the announcement hero media columns.
--
-- Media is now added inline through the rich-text editor only (which uploads to
-- object storage and embeds the URL in `content`). The separate hero slot these
-- columns fed — a full-bleed image/video rendered above the title — has been
-- removed from the widget, the forms, the public API, and the Excel import.
ALTER TABLE "Announcement" DROP COLUMN "imageUrl";
ALTER TABLE "Announcement" DROP COLUMN "videoUrl";
