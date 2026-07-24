-- Add APPEAR to the announcement event types.
--
-- TOP_BANNER announcements are a teaser: being shown is not the same as the
-- content having been read. The banner now records APPEAR when it renders, and
-- VIEW only once it is expanded into the overlay. OVERLAY announcements still
-- record VIEW on render, since showing them *is* showing the content.
ALTER TYPE "AnnouncementEventType" ADD VALUE IF NOT EXISTS 'APPEAR' BEFORE 'VIEW';
