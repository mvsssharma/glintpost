-- Enable Row Level Security on tables added since 20260303120000_enable_rls.
-- Same rationale as that migration: the app talks to Postgres over a direct
-- Prisma connection as the table owner, which bypasses RLS. Enabling RLS with
-- no policies is therefore a no-op for the app, but makes every table
-- deny-all for the Supabase anon/authenticated roles via PostgREST.

ALTER TABLE "Attribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Audience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ObservedAttribute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoadmapItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoadmapSuggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoadmapVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoadmapView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackForm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackResponse" ENABLE ROW LEVEL SECURITY;

-- Prisma's own migration bookkeeping table also lives in the public schema.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
